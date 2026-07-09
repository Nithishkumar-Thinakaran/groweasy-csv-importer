"use client";

import { useState } from "react";
import type { ExtractResponse } from "@/lib/api";

const CRM_COLUMNS: (keyof ExtractResponse["imported"][number])[] = [
  "created_at",
  "name",
  "email",
  "country_code",
  "mobile_without_country_code",
  "company",
  "city",
  "state",
  "country",
  "lead_owner",
  "crm_status",
  "crm_note",
  "data_source",
  "possession_time",
  "description",
];

export default function ResultsTable({ result }: { result: ExtractResponse }) {
  const [tab, setTab] = useState<"imported" | "skipped">("imported");

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Imported" value={result.total_imported} tone="green" />
        <SummaryCard label="Skipped" value={result.total_skipped} tone="amber" />
        <SummaryCard
          label="Total rows"
          value={result.total_imported + result.total_skipped}
          tone="gray"
        />
        <SummaryCard
          label="Failed batches"
          value={result.failedBatches?.length ?? 0}
          tone={result.failedBatches?.length ? "red" : "gray"}
        />
      </div>

      <div className="mb-3 flex gap-2">
        <TabButton active={tab === "imported"} onClick={() => setTab("imported")}>
          Imported ({result.total_imported})
        </TabButton>
        <TabButton active={tab === "skipped"} onClick={() => setTab("skipped")}>
          Skipped ({result.total_skipped})
        </TabButton>
      </div>

      {tab === "imported" ? (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                {CRM_COLUMNS.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.imported.map((rec, i) => (
                <tr key={i}>
                  {CRM_COLUMNS.map((c) => (
                    <td key={c}>{rec[c] || <span className="text-gray-400">—</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Reason</th>
                <th>Original row (raw)</th>
              </tr>
            </thead>
            <tbody>
              {result.skipped.map((s, i) => (
                <tr key={i}>
                  <td className="text-amber-600 dark:text-amber-400">{s.reason}</td>
                  <td className="max-w-md whitespace-normal">
                    <code className="text-xs">{JSON.stringify(s.original)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "amber" | "gray" | "red";
}) {
  const toneClasses: Record<string, string> = {
    green: "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
    gray: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300",
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
  };
  return (
    <div className={`rounded-xl border p-4 ${toneClasses[tone]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-brand-600 text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
      }`}
    >
      {children}
    </button>
  );
}
