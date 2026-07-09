const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type CrmRecord = {
  created_at: string;
  name: string;
  email: string;
  country_code: string;
  mobile_without_country_code: string;
  company: string;
  city: string;
  state: string;
  country: string;
  lead_owner: string;
  crm_status: string;
  crm_note: string;
  data_source: string;
  possession_time: string;
  description: string;
};

export type SkippedRecord = {
  reason: string;
  original: Record<string, string> | null;
};

export type ExtractResponse = {
  imported: CrmRecord[];
  skipped: SkippedRecord[];
  total_imported: number;
  total_skipped: number;
  failedBatches: { batchIndex: number; size: number; error: string }[];
};

export async function extractCsv(file: File): Promise<ExtractResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/extract`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }

  return res.json();
}
