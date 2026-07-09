import { GoogleGenAI } from "@google/genai";
import { CRM_FIELDS, ALLOWED_CRM_STATUS, ALLOWED_DATA_SOURCE } from "../constants.js";
import { withRetry, chunkArray } from "../utils/retry.js";

const BATCH_SIZE = Number(process.env.BATCH_SIZE || 15);
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 3);
const PROVIDER = process.env.AI_PROVIDER || "anthropic";

function buildSystemPrompt() {
  return `You are a data-mapping engine for the GrowEasy CRM.

You will be given an array of raw CSV rows. Each row is a JSON object whose
keys are the ORIGINAL column headers from the uploaded file (which vary
wildly between exports — Facebook Lead Ads, Google Ads, Excel exports, real
estate CRMs, manual spreadsheets, etc). You must intelligently map each row's
values into the fixed GrowEasy CRM schema below, no matter what the original
column names look like (they may be abbreviated, differently-cased, in a
different language, or nested/duplicated).

Target schema fields (use exactly these keys, all fields optional except as noted):
${CRM_FIELDS.map((f) => `- ${f}`).join("\n")}

Rules you MUST follow:
1. "crm_status" must be exactly one of: ${ALLOWED_CRM_STATUS.join(", ")}. If nothing
   in the row confidently maps to one of these, leave it as an empty string.
2. "data_source" must be exactly one of: ${ALLOWED_DATA_SOURCE.join(", ")}. If nothing
   confidently matches, leave it as an empty string — never invent a value.
3. "created_at" must be a string parseable by JavaScript's \`new Date(value)\`
   (e.g. "2026-05-13 14:20:48" or full ISO 8601). If the source date is
   ambiguous or unparseable, leave it as an empty string rather than guessing.
4. Use "crm_note" to capture: remarks, follow-up notes, extra comments, extra
   phone numbers, extra email addresses, or any useful info from the row that
   doesn't fit any other field.
5. If a row has multiple emails, use the first as "email" and append the rest
   into "crm_note". Same rule for multiple mobile numbers with
   "mobile_without_country_code".
6. Every output record must remain a single logical unit — do not introduce
   raw, un-escaped newlines inside any field value; use "\\n" if a line break
   is genuinely necessary.
7. If a row has NEITHER a usable email NOR a usable mobile number, you must
   SKIP it — do not include it in "records"; instead include it in "skipped"
   with a short "reason".
8. Never fabricate data that isn't implied by the row.

Respond with ONLY valid JSON (no markdown fences, no commentary) matching this
exact shape:
{
  "records": [ { "source_index": <int>, ${CRM_FIELDS.map((f) => `"${f}": ""`).join(", ")} }, ... ],
  "skipped": [ { "source_index": <int>, "reason": "" }, ... ]
}

"source_index" is the 0-based index of the row within the batch you were given,
so results can be matched back to their original source row. Every input row
must appear exactly once, either in "records" or in "skipped".`;
}

function buildUserPrompt(batch) {
  const indexed = batch.map((row, i) => ({ source_index: i, ...row }));
  return `Map the following ${batch.length} CSV row(s) into the GrowEasy CRM schema. Return JSON only.\n\nRows:\n${JSON.stringify(indexed, null, 2)}`;
}

function extractJson(text) {
  // Models occasionally wrap JSON in ```json fences despite instructions -
  // strip those defensively before parsing.
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in AI response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function callAnthropic(systemPrompt, userPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }
  const data = await res.json();
  const text = (data.content || []).map((b) => b.text || "").join("\n");
  return extractJson(text);
}

async function callOpenAI(systemPrompt, userPrompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI API error ${res.status}: ${body}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  return extractJson(text);
}

async function callGemini(systemPrompt, userPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const ai = new GoogleGenAI({
    apiKey,
  });

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `${systemPrompt}\n\n${userPrompt}`,
      config: {
        responseMimeType: "application/json",
      },
    });

    return extractJson(response.text);
  } catch (err) {
    throw new Error(`Gemini API error: ${err.message}`);
  }
}

async function callProvider(systemPrompt, userPrompt) {
  if (PROVIDER === "openai") return callOpenAI(systemPrompt, userPrompt);
  if (PROVIDER === "gemini") return callGemini(systemPrompt, userPrompt);
  return callAnthropic(systemPrompt, userPrompt);
}

/** Best-effort repair/validation of a single AI-produced record. */
function sanitizeRecord(record) {
  const clean = {};
  for (const field of CRM_FIELDS) {
    clean[field] = String(record[field] ?? "").trim();
  }

  if (clean.crm_status && !ALLOWED_CRM_STATUS.includes(clean.crm_status)) {
    clean.crm_note = [clean.crm_note, `(original status: ${clean.crm_status})`]
      .filter(Boolean)
      .join(" | ");
    clean.crm_status = "";
  }

  if (clean.data_source && !ALLOWED_DATA_SOURCE.includes(clean.data_source)) {
    clean.data_source = "";
  }

  if (clean.created_at) {
    const parsed = new Date(clean.created_at);
    if (Number.isNaN(parsed.getTime())) {
      clean.crm_note = [clean.crm_note, `(unparsed date: ${clean.created_at})`]
        .filter(Boolean)
        .join(" | ");
      clean.created_at = "";
    }
  }

  // Escape stray newlines so the record stays a single CSV/JSON-safe row.
  for (const field of CRM_FIELDS) {
    clean[field] = clean[field].replace(/\r?\n/g, "\\n");
  }

  return clean;
}

/**
 * Runs AI extraction over all parsed CSV rows, in batches, with retries.
 * Returns { imported, skipped, total_imported, total_skipped, failedBatches }
 */
export async function extractCrmRecords(rows, { onProgress } = {}) {
  const batches = chunkArray(rows, BATCH_SIZE);
  const imported = [];
  const skipped = [];
  const failedBatches = [];

  const systemPrompt = buildSystemPrompt();

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    try {
      const result = await withRetry(
        () => callProvider(systemPrompt, buildUserPrompt(batch)),
        {
          retries: MAX_RETRIES,
          onRetry: (err, attempt) =>
            console.warn(`Batch ${b} attempt ${attempt} failed: ${err.message}`),
        }
      );

      const seen = new Set();

      for (const rec of result.records || []) {
        const idx = rec.source_index;
        seen.add(idx);
        imported.push(sanitizeRecord(rec));
      }

      for (const skip of result.skipped || []) {
        seen.add(skip.source_index);
        skipped.push({
          reason: skip.reason || "Missing email and mobile number",
          original: batch[skip.source_index] ?? null,
        });
      }

      // Guard against the model dropping rows entirely.
      batch.forEach((row, i) => {
        if (!seen.has(i)) {
          skipped.push({ reason: "Not returned by AI model", original: row });
        }
      });
    } catch (err) {
      console.error(`Batch ${b} failed after ${MAX_RETRIES} attempts:`, err.message);
      failedBatches.push({ batchIndex: b, size: batch.length, error: err.message });
      batch.forEach((row) => {
        skipped.push({ reason: `AI processing failed: ${err.message}`, original: row });
      });
    }

    if (onProgress) onProgress({ completed: b + 1, total: batches.length });
  }

  return {
    imported,
    skipped,
    total_imported: imported.length,
    total_skipped: skipped.length,
    failedBatches,
  };
}
