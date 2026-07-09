# GrowEasy AI CSV Importer

An AI-powered CSV importer that ingests **any** CSV layout (Facebook Lead Ads,
Google Ads exports, Excel sheets, real estate CRM exports, manual
spreadsheets, etc.) and intelligently maps it into the GrowEasy CRM schema —
without assuming fixed column names.

```
csv-importer/
├── frontend/   # Next.js app (upload → preview → confirm → results)
├── backend/    # Node.js + Express API (parse → batch → AI map → JSON)
└── samples/    # Example CSVs in different formats, for testing
```

## How it works

1. **Upload** — user drags/drops or picks a `.csv` file.
2. **Preview** — the file is parsed client-side (PapaParse) and shown in a
   scrollable, sticky-header table. No AI calls happen yet.
3. **Confirm** — user clicks "Confirm & Import", which uploads the raw file
   to the backend.
4. **Backend pipeline**:
   - Parses the CSV (again, server-side, treating headers as arbitrary).
   - Splits rows into batches (`BATCH_SIZE`, default 15).
   - Sends each batch to an LLM (Claude / OpenAI / Gemini — configurable)
     with a strict system prompt describing the target schema, the allowed
     enum values, and the field-mapping rules from the assignment brief.
   - Retries failed batches with exponential backoff (`MAX_RETRIES`).
   - Validates/repairs the AI's output (enum whitelisting, date
     parseability, newline escaping) before returning it.
5. **Results** — the frontend shows imported vs. skipped records, with
   counts and skip reasons.

## Local setup

### 1. Backend

```bash
cd backend
cp .env.example .env
# edit .env and add your ANTHROPIC_API_KEY (or switch AI_PROVIDER)
npm install
npm run dev
# -> http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
# -> http://localhost:3000
```

Open `http://localhost:3000`, upload one of the CSVs in `/samples`, preview
it, click **Confirm & Import**, and watch the AI-mapped results appear.

## Configuration

All backend behavior is controlled via `backend/.env` (see
`.env.example` for the full list):

| Variable | Purpose |
|---|---|
| `AI_PROVIDER` | `anthropic` (default) \| `openai` \| `gemini` |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Claude credentials + model |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | OpenAI credentials + model |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Gemini credentials + model |
| `BATCH_SIZE` | Rows sent to the AI per request (default 15) |
| `MAX_RETRIES` | Retry attempts per batch before it's marked failed |
| `CORS_ORIGIN` | Allowed frontend origin(s), comma-separated |

## Deployment

**Backend → Render / Railway:**
1. Push this repo to GitHub.
2. Create a new Web Service pointing at `backend/`.
3. Build command: `npm install` — Start command: `npm start`.
4. Add the env vars from `.env.example` (with your real API key).
5. Note the deployed URL, e.g. `https://csv-importer-api.onrender.com`.

**Frontend → Vercel:**
1. Import the repo, set the root directory to `frontend/`.
2. Add env var `NEXT_PUBLIC_API_URL` = your deployed backend URL.
3. Deploy. Vercel will give you the public app URL to submit.

Update `CORS_ORIGIN` on the backend to include your deployed frontend's
origin once you have it.

## Design notes / what to look at

- `backend/src/services/aiExtractor.js` — the core prompt-engineering +
  batching + retry + validation logic.
- `backend/src/services/csvParser.js` — header-agnostic CSV parsing.
- `frontend/app/page.tsx` — the 4-step upload/preview/confirm/results flow.
- `frontend/components/ResultsTable.tsx` — imported/skipped tabs + summary.

## Known limitations / next steps

- Very large files (>~5k rows) will make many sequential AI calls; batches
  could be parallelized (with a concurrency cap) for speed.
- No database — the app is stateless by design per the assignment's
  "optional" database requirement; results are not persisted between runs.
- No automated test suite yet — would add Jest/Vitest coverage for
  `sanitizeRecord`, `chunkArray`, and the CSV parser next.

## Submission

- Position applying for: **[Intern / Full-Time — update before sending]**
- Hosted app URL: `<add after deploying to Vercel>`
- GitHub repo URL: `<add after pushing to GitHub>`
- Email to: `varun@groweasy.ai` before **12 July 2026**
