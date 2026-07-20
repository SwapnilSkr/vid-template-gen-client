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

export interface YoutubeSearchPage {
  items: YoutubeSearchResult[];
  nextPageToken?: string;
}

export interface YtImportCaptionCue {
  startSec: number;
  endSec: number;
  text: string;
}

export interface YtImportFrameDelivery {
  mode: "api" | "cdn";
  /** CDN base through `frames/` — append frame_000001.jpg. Only set for S3. */
  cdnFramesPrefix?: string;
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
  purpose: "reference" | "gameplay" | "gameplay_mix";
  sourceVideoIds?: string[];
  gameplayMixSources?: Array<{ videoId: string; startSec?: number; endSec?: number }>;
  sourceTrimStartSec?: number;
  sourceTrimEndSec?: number;
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
  gameplayClipKeys?: string[];
  frameIndices?: number[];
  frameIndicesTotal?: number;
  frameDelivery?: YtImportFrameDelivery;
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
  try {
    const headers = new Headers(init?.headers);
    if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
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

export function resolveMediaUrl(pathOrUrl?: string): string | undefined {
  if (!pathOrUrl) return undefined;
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  return `${SERVER_BASE}${pathOrUrl}`;
}

export async function searchYoutube(q: string, maxResults = 12, pageToken?: string): Promise<YoutubeSearchPage> {
  const params = new URLSearchParams({ q, maxResults: String(maxResults) });
  if (pageToken) params.set("pageToken", pageToken);
  return request<YoutubeSearchPage>(`/yt-imports/search?${params}`);
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
  asGameplay?: boolean;
  sourceTrimStartSec?: number;
  sourceTrimEndSec?: number;
  /** Bake a playback rate into muted gameplay segments (default 1). */
  gameplaySpeed?: number;
}): Promise<YtImport> {
  return request<YtImport>("/yt-imports", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createGameplayMix(body: {
  sources: Array<{ videoId: string; startSec?: number; endSec?: number }>;
  title?: string;
}): Promise<YtImport> {
  return request<YtImport>("/yt-imports/gameplay-mix", {
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

export function frameUrlForImport(item: Pick<YtImport, "_id" | "frameDelivery">, frameIndex: number): string {
  if (item.frameDelivery?.mode === "cdn" && item.frameDelivery.cdnFramesPrefix) {
    return `${item.frameDelivery.cdnFramesPrefix}frame_${String(frameIndex).padStart(6, "0")}.jpg`;
  }
  return `${API_BASE}/yt-imports/${item._id}/frames/${frameIndex}`;
}

/** @deprecated Prefer frameUrlForImport(item, index) for storage-aware URLs. */
export function frameUrl(id: string, frameIndex: number): string {
  return `${API_BASE}/yt-imports/${id}/frames/${frameIndex}`;
}
