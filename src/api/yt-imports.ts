const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";
export const SERVER_BASE = API_BASE.replace(/\/api\/?$/, "");

export type YtImportStorage = "local" | "s3";
export type YtImportStatus =
  | "pending"
  | "downloading"
  | "uploading"
  | "extracting_frames"
  | "completed"
  | "failed";

export interface YoutubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl?: string;
  description?: string;
  publishedAt?: string;
  durationSec?: number;
  viewCount?: number;
}

export interface YtImportCaptionCue {
  startSec: number;
  endSec: number;
  text: string;
}

export interface YtImport {
  _id: string;
  assetId: string;
  youtubeVideoId: string;
  sourceUrl: string;
  title: string;
  channelTitle: string;
  thumbnailUrl?: string;
  durationSec?: number;
  storage: YtImportStorage;
  downloadCaptions: boolean;
  extractFrames: boolean;
  frameRangeStartSec?: number;
  frameRangeEndSec?: number;
  status: YtImportStatus;
  progress: number;
  error?: string;
  videoUrl?: string;
  audioUrl?: string;
  captionsUrl?: string;
  captions?: YtImportCaptionCue[];
  frameCount: number;
  fps?: number;
  framesExtracted: boolean;
  frameIndices?: number[];
  frameIndicesTotal?: number;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? `Request failed: ${res.status}`);
  }
  return json.data;
}

export function resolveMediaUrl(pathOrUrl?: string): string | undefined {
  if (!pathOrUrl) return undefined;
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  return `${SERVER_BASE}${pathOrUrl}`;
}

export async function searchYoutube(q: string, maxResults = 12): Promise<YoutubeSearchResult[]> {
  const params = new URLSearchParams({ q, maxResults: String(maxResults) });
  return request<YoutubeSearchResult[]>(`/yt-imports/search?${params}`);
}

export async function listYtImports(limit = 50): Promise<YtImport[]> {
  return request<YtImport[]>(`/yt-imports?limit=${limit}`);
}

export async function getYtImport(id: string): Promise<YtImport> {
  return request<YtImport>(`/yt-imports/${id}`);
}

export async function createYtImport(body: {
  videoId: string;
  storage: YtImportStorage;
  downloadCaptions?: boolean;
  extractFrames?: boolean;
  frameRangeStartSec?: number;
  frameRangeEndSec?: number;
}): Promise<YtImport> {
  return request<YtImport>("/yt-imports", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function extractFrames(
  id: string,
  range?: { startSec?: number; endSec?: number }
): Promise<{ range: { startSec: number; endSec: number } }> {
  return request(`/yt-imports/${id}/extract-frames`, {
    method: "POST",
    body: JSON.stringify(range ?? {}),
  });
}

export async function deleteYtImport(id: string): Promise<void> {
  await request(`/yt-imports/${id}`, { method: "DELETE" });
}

export async function getCaptionAt(
  id: string,
  atSec: number
): Promise<{ timestampSec: number; frameIndex: number; caption: YtImportCaptionCue | null }> {
  return request(`/yt-imports/${id}/caption-at?at=${atSec}`);
}

export function audioClipUrl(id: string, atSec: number, durationSec = 3): string {
  return `${API_BASE}/yt-imports/${id}/audio-clip?at=${atSec}&duration=${durationSec}`;
}

export function frameUrl(id: string, frameIndex: number): string {
  return `${API_BASE}/yt-imports/${id}/frames/${frameIndex}`;
}
