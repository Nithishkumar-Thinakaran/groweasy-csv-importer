"use client";

type Props = {
  headers: string[];
  rows: Record<string, string>[];
  maxRows?: number;
};

export default function PreviewTable({ headers, rows, maxRows = 50 }: Props) {
  const shown = rows.slice(0, maxRows);

  return (
    <div>
      <div className="table-shell">
        <table>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr key={i}>
                {headers.map((h) => (
                  <td key={h}>{row[h] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > maxRows && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Showing first {maxRows} of {rows.length} rows.
        </p>
      )}
    </div>
  );
}
