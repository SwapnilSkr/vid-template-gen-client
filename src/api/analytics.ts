const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";

export type OwnedAnalyticsPlatform = "youtube" | "instagram" | "facebook" | "threads";

export interface PerformanceEvidenceCard {
  _id: string;
  platform: OwnedAnalyticsPlatform;
  account: { scope: "all" | "account"; key?: string; label?: string };
  genre: string;
  window: { key: string; startsAt: string; endsAt: string; days: number };
  guidance: { summary: string; hookPatterns: string[]; cautions: string[] };
  confidence: { level: "low" | "medium" | "high"; sampleSize: number; reelCount: number; snapshotCount: number; reasons: string[] };
  source: { generatedAt: string };
}

export interface OwnedAnalyticsOverview {
  snapshots: number;
  cards: PerformanceEvidenceCard[];
  platforms: { platform: OwnedAnalyticsPlatform; snapshots: number; lastFetchedAt?: string }[];
}

export interface OwnedAnalyticsSyncResult {
  scanned: number;
  skippedFresh: number;
  snapshotsCreated: number;
  unavailable: number;
  cardsRebuilt: number;
  failed: { platform: OwnedAnalyticsPlatform; accountKey: string; mediaId: string; error: string }[];
  requiresReauth: { platform: OwnedAnalyticsPlatform; accountKey: string; error: string }[];
}

interface ApiResponse<T> { success: boolean; data: T; error?: string }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const json = await response.json() as ApiResponse<T>;
  if (!response.ok || !json.success) throw new Error(json.error ?? `Request failed: ${response.status}`);
  return json.data;
}

export function getOwnedAnalyticsOverview(): Promise<OwnedAnalyticsOverview> {
  return request("/analytics/overview");
}

export function syncOwnedAnalytics(platform?: OwnedAnalyticsPlatform): Promise<OwnedAnalyticsSyncResult> {
  return request("/analytics/sync", { method: "POST", body: JSON.stringify(platform ? { platform } : {}) });
}
