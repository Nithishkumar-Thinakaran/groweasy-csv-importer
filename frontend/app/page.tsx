"use client";

import { useState } from "react";
import Papa from "papaparse";
import FileUpload from "@/components/FileUpload";
import PreviewTable from "@/components/PreviewTable";
import ResultsTable from "@/components/ResultsTable";
import { extractCsv, type ExtractResponse } from "@/lib/api";

type Step = "upload" | "preview" | "loading" | "results";

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  function handleFileSelected(selected: File) {
    setFile(selected);
    setError(null);

    // Client-side parse for an instant preview. No AI happens here.
    Papa.parse(selected, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = (res.data as Record<string, string>[]).filter((r) =>
          Object.values(r).some((v) => String(v ?? "").trim() !== "")
        );
        setHeaders(res.meta.fields || []);
        setRows(data);
        setStep("preview");
      },
      error: (err) => setError(err.message),
    });
  }

  async function handleConfirm() {
    if (!file) return;
    setStep("loading");
    setError(null);
    try {
      const res = await extractCsv(file);
      setResult(res);
      setStep("results");
    } catch (err: any) {
      setError(err.message || "Something went wrong during AI extraction");
      setStep("preview");
    }
  }

  function reset() {
    setFile(null);
    setHeaders([]);
    setRows([]);
    setResult(null);
    setError(null);
    setStep("upload");
  }

  return (
    <div className={darkMode ? "dark" : ""}>
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <header className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                GrowEasy CSV Importer
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Upload any CSV — the AI maps it to the CRM schema automatically
              </p>
            </div>
            <button
              onClick={() => setDarkMode((d) => !d)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-900"
            >
              {darkMode ? "☀️ Light" : "🌙 Dark"}
            </button>
          </header>

          <Steps current={step} />

          {error && (
            <div className="my-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="mt-6">
            {step === "upload" && <FileUpload onFileSelected={handleFileSelected} />}

            {step === "preview" && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold">
                    Preview — {rows.length} row(s) detected in {file?.name}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={reset}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-900"
                    >
                      Choose different file
                    </button>
                    <button
                      onClick={handleConfirm}
                      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                    >
                      Confirm & Import
                    </button>
                  </div>
                </div>
                <PreviewTable headers={headers} rows={rows} />
              </div>
            )}

            {step === "loading" && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-gray-200 py-20 dark:border-gray-800">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
                <p className="font-medium">AI is mapping your CRM fields…</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This can take a moment for larger files — rows are processed in batches.
                </p>
              </div>
            )}

            {step === "results" && result && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-semibold">Import results</h2>
                  <button
                    onClick={reset}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-900"
                  >
                    Import another file
                  </button>
                </div>
                <ResultsTable result={result} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Steps({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "1. Upload" },
    { key: "preview", label: "2. Preview" },
    { key: "loading", label: "3. AI Import" },
    { key: "results", label: "4. Results" },
  ];
  const order: Step[] = ["upload", "preview", "loading", "results"];
  const currentIdx = order.indexOf(current);

  return (
    <div className="flex flex-wrap gap-2 text-sm">
      {steps.map((s, i) => (
        <span
          key={s.key}
          className={`rounded-full px-3 py-1 font-medium ${
            i <= currentIdx
              ? "bg-brand-600 text-white"
              : "bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-500"
          }`}
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}
