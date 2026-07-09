import Papa from "papaparse";

/**
 * Parses a raw CSV buffer/string into an array of row objects,
 * preserving whatever original column headers the file has.
 * We do NOT assume any fixed column names here — that mapping
 * job is left entirely to the AI extraction step.
 */
export function parseCsv(csvString) {
  const result = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  });

  if (result.errors?.length) {
    // PapaParse reports row-level parse errors (e.g. malformed rows).
    // We don't fail the whole import for these — just surface them,
    // the caller can decide whether to treat as skipped rows.
    console.warn(
      `CSV parser reported ${result.errors.length} row issue(s):`,
      result.errors.slice(0, 5)
    );
  }

  const rows = result.data.filter((row) =>
    Object.values(row).some((v) => String(v ?? "").trim() !== "")
  );

  return { rows, meta: result.meta, errors: result.errors };
}
