import { Router } from "express";
import multer from "multer";
import { parseCsv } from "../services/csvParser.js";
import { extractCrmRecords } from "../services/aiExtractor.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.toLowerCase().endsWith(".csv");
    cb(ok ? null : new Error("Only .csv files are supported"), ok);
  },
});

/**
 * POST /api/parse
 * Backend-side CSV parse only (no AI). Useful for validating a file
 * before committing to a full AI extraction pass.
 */
router.post("/parse", upload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const csvString = req.file.buffer.toString("utf-8");
    const { rows, errors } = parseCsv(csvString);
    res.json({ headers: rows[0] ? Object.keys(rows[0]) : [], rows, row_count: rows.length, parse_warnings: errors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/extract
 * Full pipeline: accept CSV -> parse -> batch -> AI map -> return CRM JSON.
 */
router.post("/extract", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const csvString = req.file.buffer.toString("utf-8");
    const { rows } = parseCsv(csvString);

    if (rows.length === 0) {
      return res.status(400).json({ error: "CSV file has no data rows" });
    }

    const result = await extractCrmRecords(rows);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "AI extraction failed" });
  }
});

export default router;
