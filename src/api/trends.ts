const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";

export interface TrendReference {
  _id?: string;
  niche: string;
  genre?: string;
  sourceUrl: string;
  platform: string;
  title?: string;
  thumbnailUrl?: string;
  channelTitle?: string;
  status: "candidate" | "reviewed" | "approved" | "rejected" | "archived";
  metrics: {
    views?: number;
    likes?: number;
    comments?: number;
    durationSec?: number;
    postedAt?: string;
  };
  dayOfWeek?: number;
  hourUtc?: number;
  scanWindow?: string;
}

export interface TrendTopPerformer {
  title?: string;
  thumbnailUrl?: string;
  channelTitle?: string;
  sourceUrl: string;
  views?: number;
  postedAt?: string;
}

export interface TrendPostingBucket {
  dayOfWeek: number;
  hourUtc: number;
  weightedScore: number;
}

export interface TrendGenreSummary {
  genre: string;
  displayLabel: string;
  sampleSize: number;
  topPerformers: TrendTopPerformer[];
  postingBuckets: TrendPostingBucket[];
  bestPostingTime?: { dayOfWeek: number; hourUtc: number };
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...init?.headers },
      ...init,
    });
    const json = (await res.json()) as ApiResponse<T>;
    if (!res.ok || !json.success) {
      throw new Error(json.error ?? `Request failed: ${res.status}`);
    }
    return json.data;
  } catch (error) {
    if (error instanceof Error && error.message !== "Failed to fetch") throw error;
    throw new Error(`API unavailable at ${API_BASE}. Start the server or set VITE_API_BASE_URL.`);
  }
}

export async function listTrends(genre?: string): Promise<TrendReference[]> {
  const query = genre ? `?genre=${encodeURIComponent(genre)}` : "";
  return request<TrendReference[]>(`/trends${query}`);
}

export async function getTrendSummary(period: "week" | "month", niche = "reddit"): Promise<TrendGenreSummary[]> {
  return request<TrendGenreSummary[]>(`/trends/summary?period=${period}&niche=${encodeURIComponent(niche)}`);
}

export async function triggerTrendScout(window: "week" | "month", niche = "reddit"): Promise<{ digestsRefreshed: number }> {
  return request(`/trends/scout`, { method: "POST", body: JSON.stringify({ window, niche }) });
}
