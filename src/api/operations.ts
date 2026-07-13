const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";

export type OperationLogLevel = "debug" | "info" | "warn" | "error";
export type OperationLogScope = "api" | "queue" | "worker" | "external" | "system";

export interface OperationLog {
  _id: string;
  requestId?: string;
  level: OperationLogLevel;
  scope: OperationLogScope;
  event: string;
  message: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  reelId?: string;
  jobId?: string;
  metadata?: Record<string, unknown>;
  error?: { name?: string; message: string; stack?: string; code?: string };
  createdAt: string;
}

export interface OperationLogPage {
  logs: OperationLog[];
  nextBefore?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  // A content type on a body-less GET turns this local cross-origin API call
  // into a CORS preflight. Only declare JSON when we are actually sending it.
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  const payload = (await response.json().catch(() => undefined)) as
    | { success?: boolean; data?: T; error?: string }
    | undefined;
  if (!response.ok || payload?.success === false || !payload?.data) {
    throw new Error(payload?.error || `Operations request failed (${response.status})`);
  }
  return payload.data;
}

export async function listOperationLogs(filters: {
  limit?: number;
  before?: string;
  level?: OperationLogLevel;
  scope?: OperationLogScope;
  reelId?: string;
} = {}): Promise<OperationLogPage> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const suffix = query.size ? `?${query}` : "";
  return request<OperationLogPage>(`/operations${suffix}`);
}

export async function deleteOperationLog(id: string): Promise<void> {
  await request<{ deleted: number }>(`/operations/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function deleteOperationLogs(ids: string[]): Promise<number> {
  const result = await request<{ deleted: number }>("/operations", {
    method: "DELETE",
    body: JSON.stringify({ ids }),
  });
  return result.deleted;
}

export async function deleteAllOperationLogs(): Promise<number> {
  const result = await request<{ deleted: number }>("/operations/all", { method: "DELETE" });
  return result.deleted;
}
