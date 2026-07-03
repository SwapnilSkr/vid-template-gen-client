const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";

export type ReelStatus =
  | "pending"
  | "planning"
  | "generating_assets"
  | "generating_audio"
  | "aligning"
  | "rendering"
  | "uploading"
  | "completed"
  | "failed";

export interface ReelReview {
  title?: string;
  description?: string;
  tags: string[];
  thumbnailUrl?: string;
  thumbnailPrompt?: string;
  visibilityNotes?: string;
  status: "draft" | "ready" | "approved";
  updatedAt?: string;
}

export interface ReelCostLine {
  label: string;
  model?: string;
  units: number;
  unit: string;
  unitCostUsd: number;
  costUsd: number;
}

export interface ReelCostBreakdown {
  currency: "USD";
  totalUsd: number;
  lines: ReelCostLine[];
  note?: string;
  generatedAt?: string;
}

export interface Reel {
  _id?: string;
  id?: string;
  niche: string;
  topic: string;
  genre?: string;
  source?: string;
  storySource?: string;
  strategy?: string;
  title?: string;
  hook?: string;
  status: ReelStatus;
  progress: number;
  outputUrl?: string;
  subtitlesUrl?: string;
  costUsd?: number;
  costBreakdown?: ReelCostBreakdown;
  error?: string;
  review?: ReelReview;
  youtube?: {
    status: "pending" | "uploading" | "published" | "failed";
    videoId?: string;
    url?: string;
    error?: string;
    channelId?: string;
    channelLabel?: string;
    thumbnailStatus?: "pending" | "uploaded" | "missing" | "failed";
    thumbnailError?: string;
    publishedAt?: string;
  };
  partNumber?: number;
  partCount?: number;
  createdAt?: string;
  gameplayKey?: string;
  horrorAudioKey?: string;
  outroChannelId?: string;
  imageModelOverride?: string;
  artStyleId?: string;
  motionMode?: MotionMode;
  storyBible?: StoryBible;
  voiceOverride?: { model?: string; voice?: string; format?: "mp3" | "pcm" };
  voiceVariants?: VoiceVariant[];
}

export type YouTubePublishStatus = NonNullable<Reel["youtube"]>;

export type MotionMode = "ken_burns" | "parallax" | "ai_hybrid" | "ai_full";

export interface StoryBible {
  premise: string;
  setting: string;
  protagonist: string;
  anchorObject: string;
  impossibleRule: string;
  escalation: string[];
  soundCues?: string[];
  artDirection: string;
  finalTwist: string;
}

export interface ArtStyleOption {
  id: string;
  displayName: string;
  description: string;
  niches: string[];
  referenceKeys: string[];
  thumbnailUrl?: string;
  attribution: { title?: string; license?: string; source?: string }[];
  motionHint?: "parallax" | "ai_motion";
}

export interface CreateReelInput {
  niche: string;
  genre?: string;
  topic?: string;
  tier?: "cheap" | "value" | "premium";
  source?: "llm" | "hybrid" | "verbatim";
  parts?: "off" | "auto" | number;
  gameplayKey?: string;
  horrorAudioKey?: string;
  outroChannelId?: string;
  imageModel?: string;
  artStyleId?: string;
  motionMode?: MotionMode;
  ttsModel?: string;
  ttsVoice?: string;
  ttsFormat?: "mp3" | "pcm";
}

export interface GameplayClip {
  key: string;
  url: string;
  filename: string;
}

export interface HorrorAudioOption {
  key: string;
  url: string;
  label: string;
  title?: string;
  license?: string;
  landingUrl?: string;
}

export interface TtsVoiceOption {
  model: string;
  voice: string;
  format: "mp3" | "pcm";
  label: string;
  provider?: string;
  priceLabel?: string;
  unitPriceLabel?: string;
  priceNote?: string;
  recommendedFor?: string[];
}

export interface YouTubeChannelOption {
  id: string;
  label: string;
  googleChannelId?: string;
  googleChannelTitle?: string;
  googleChannelHandle?: string;
  logoUrl?: string;
  privacyStatus: "private" | "unlisted" | "public";
  categoryId: string;
  niches?: string[];
  isDefault: boolean;
  source: "env" | "database";
  status?: "active" | "needs_reauth" | "disabled";
  lastError?: string;
}

export interface ImageModelOption {
  model: string;
  label: string;
  priceLabel: string;
  priceNote: string;
  recommendedTier: "cheap" | "value" | "premium";
  supportsReferenceArt?: boolean;
  healthy?: boolean;
  pricingType?: "flat" | "variable";
  perImageUsd?: number;
  probeCostUsd?: number;
}

export interface ReelDefaults {
  niche: string;
  tier: "cheap" | "value" | "premium";
  tts: TtsVoiceOption;
  scriptModel: string;
}

export interface VoiceVariant {
  id: string;
  model: string;
  voice: string;
  format: "mp3" | "pcm";
  label?: string;
  status: "pending" | "ready" | "failed";
  videoUrl?: string;
  error?: string;
  createdAt?: string;
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

export async function listReels(): Promise<Reel[]> {
  return request<Reel[]>("/reels?limit=40");
}

export async function listYouTubeChannels(): Promise<YouTubeChannelOption[]> {
  return request<YouTubeChannelOption[]>("/youtube/channels");
}

export async function startYouTubeChannelConnect(input: {
  label: string;
  channelKey?: string;
  privacyStatus?: "private" | "unlisted" | "public";
  categoryId?: string;
  niches?: string[];
}): Promise<{ authUrl: string }> {
  return request<{ authUrl: string }>("/youtube/connect/start", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteYouTubeChannel(id: string): Promise<void> {
  await request(`/youtube/channels/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function createReel(input: CreateReelInput): Promise<{ id: string; parts: Reel[] }> {
  return request("/reels", { method: "POST", body: JSON.stringify(input) });
}

export async function getReel(id: string): Promise<Reel> {
  return request<Reel>(`/reels/${id}/status`);
}

export async function getReview(id: string): Promise<ReelReview> {
  return request<ReelReview>(`/reels/${id}/review`);
}

export async function updateReview(id: string, review: Partial<ReelReview>): Promise<ReelReview> {
  return request<ReelReview>(`/reels/${id}/review`, {
    method: "PUT",
    body: JSON.stringify(review),
  });
}

export async function regenerateThumbnail(id: string, review: Partial<ReelReview>): Promise<ReelReview> {
  return request<ReelReview>(`/reels/${id}/review/thumbnail`, {
    method: "POST",
    body: JSON.stringify(review),
  });
}

export async function publishReel(
  id: string,
  channelId?: string
): Promise<{ youtube?: YouTubePublishStatus }> {
  return request<{ youtube?: YouTubePublishStatus }>(`/reels/${id}/publish`, {
    method: "POST",
    body: JSON.stringify({ channelId }),
  });
}

export async function deleteReel(id: string): Promise<void> {
  await request(`/reels/${id}`, { method: "DELETE" });
}

export async function purgeFailedReels(): Promise<{ deleted: string[]; errors: { id: string; error: string }[] }> {
  return request("/maintenance/reels/purge-failed", { method: "POST" });
}

export async function listGameplay(): Promise<GameplayClip[]> {
  return request<GameplayClip[]>("/gameplay");
}

export async function listHorrorAudio(): Promise<HorrorAudioOption[]> {
  return request<HorrorAudioOption[]>("/horror-audio");
}

export async function listImageModels(): Promise<ImageModelOption[]> {
  return request<ImageModelOption[]>("/image-models");
}

export async function listArtStyles(niche?: string): Promise<ArtStyleOption[]> {
  const q = niche ? `?niche=${encodeURIComponent(niche)}` : "";
  return request<ArtStyleOption[]>(`/art-styles${q}`);
}

export async function listTtsVoices(): Promise<TtsVoiceOption[]> {
  return request<TtsVoiceOption[]>("/tts-voices");
}

export async function getReelDefaults(
  niche: string,
  tier: "cheap" | "value" | "premium" = "cheap"
): Promise<ReelDefaults> {
  return request<ReelDefaults>(`/reel-defaults?niche=${encodeURIComponent(niche)}&tier=${encodeURIComponent(tier)}`);
}

export async function getVoiceSample(model: string, voice: string): Promise<string> {
  const { url } = await request<{ url: string }>(
    `/tts-voices/sample?model=${encodeURIComponent(model)}&voice=${encodeURIComponent(voice)}`
  );
  return url;
}

export interface RevoiceVariantInput {
  model?: string;
  voice?: string;
  format?: "mp3" | "pcm";
  label?: string;
}

export async function revoiceReel(id: string, variants: RevoiceVariantInput[]): Promise<VoiceVariant[]> {
  return request<VoiceVariant[]>(`/reels/${id}/revoice`, {
    method: "POST",
    body: JSON.stringify({ variants }),
  });
}

export async function promoteVoiceVariant(
  id: string,
  variantId: string
): Promise<{ outputUrl?: string; voiceVariants: VoiceVariant[] }> {
  return request(`/reels/${id}/revoice/${variantId}/promote`, { method: "POST" });
}

export async function useFrameAsThumbnail(id: string, atSeconds: number): Promise<ReelReview> {
  return request<ReelReview>(`/reels/${id}/review/thumbnail/frame`, {
    method: "POST",
    body: JSON.stringify({ atSeconds }),
  });
}
