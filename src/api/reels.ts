const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";
const SERVER_BASE = API_BASE.replace(/\/api\/?$/, "");

export type ReelStatus =
  | "pending"
  | "planning"
  | "plan_review"
  | "generating_assets"
  | "generating_audio"
  | "aligning"
  | "rendering"
  | "uploading"
  | "completed"
  | "failed";

export interface SceneMotion {
  type: "ken_burns" | "static" | "parallax" | "ai_motion";
  direction?: "in" | "out";
  intensity?: number;
}

export interface Scene {
  index: number;
  narration: string;
  visualPrompt: string;
  assetUrl?: string;
  audioUrl?: string;
  motion: SceneMotion;
  startTime: number;
  duration: number;
  isHero: boolean;
}

export interface CaptionStyle {
  fontName?: string;
  fontSize?: number;
  primaryColor?: string;
  activeColor?: string;
  outlineColor?: string;
  outlineWidth?: number;
  shadow?: number;
  alignment?: number;
  marginV?: number;
  marginL?: number;
  marginR?: number;
  chunkSize?: number;
  bold?: boolean;
  uppercase?: boolean;
  animation?: "none" | "pop";
  karaoke?: boolean;
}

export interface AudioPost {
  voiceProfile?: "none" | "horror" | "whisper" | "phone" | "tape" | "distant";
  bedVolume?: number;
}

/** Co-creatable cinematic edit effects (render-only). Mirrors server IEditEffects. */
export interface EditEffects {
  rain?: boolean;
  rainIntensity?: number; // 0-1
  grain?: number; // 0-1.5
  vignette?: number; // 0-1
  letterbox?: boolean;
  desaturate?: number; // 0-1
  flicker?: number; // 0-1
  chromatic?: number; // 0-1
  scanlines?: number; // 0-1
}

export interface StylePreset {
  id: string;
  displayName: string;
  description: string;
  niches: string[];
  artStyleId: string;
  motionMode: MotionMode;
  voice: { model: string; voice: string; format: "mp3" | "pcm" };
  audioPost?: AudioPost;
  captionStyle: CaptionStyle;
  sceneCountHint?: number;
}

export interface ReelReview {
  title?: string;
  description?: string;
  tags: string[];
  thumbnailUrl?: string;
  thumbnailPrompt?: string;
  thumbnailEditorState?: Record<string, unknown>;
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

export interface ReelEditDraft {
  id: string;
  kind: "scene_regen" | "render_only";
  status: "ready";
  sceneAssets: { index: number; assetUrl?: string; audioUrl?: string }[];
  outputUrl?: string;
  subtitlesUrl?: string;
  createdAt?: string;
}

/** A locally staged Thumbnail Studio composition — lives on the server's disk
 *  only (no S3) until saved or discarded. `input` echoes the composition
 *  controls so the studio can restore them on reopen. */
export interface ThumbnailDraft {
  id: string;
  imageUrl: string;
  /** Opaque editor state (v2 layered doc) or legacy drawtext controls. */
  input?: Record<string, unknown>;
  aspectRatio?: ThumbnailAspectRatio;
  createdAt?: string;
}

export interface OutroSettings {
  channelName?: string;
  channelHandle?: string;
  spokenLine?: string;
  title?: string;
  subtitle?: string;
  cta?: string;
  footer?: string;
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
  /** Live pipeline step from the worker (e.g. "Image 3/9"). */
  currentStep?: string;
  outputUrl?: string;
  bodyVideoUrl?: string;
  assemblyVideoUrl?: string;
  subtitlesUrl?: string;
  /** False when FFmpeg caption burn soft-failed (video has no burned-in text). */
  captionsBurned?: boolean;
  captionBurnError?: string;
  titleAudioUrl?: string;
  partOutroAudioUrl?: string;
  outroAudioUrl?: string;
  thumbnailMode?: "frame" | "ai";
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
    /** Whether Shorts vertical cover (oar2) changed after custom thumb upload. */
    shortsCoverStatus?: "applied" | "unchanged" | "unknown";
    publishedAt?: string;
  };
  seriesId?: string;
  partNumber?: number;
  partCount?: number;
  createdAt?: string;
  updatedAt?: string;
  gameplayKey?: string;
  horrorAudioKey?: string;
  outroChannelId?: string;
  outro?: OutroSettings;
  imageModelOverride?: string;
  artStyleId?: string;
  presetId?: string;
  motionMode?: MotionMode;
  captionStyle?: CaptionStyle;
  audioPost?: AudioPost;
  editEffects?: EditEffects;
  pipelineMode?: "auto" | "review";
  providedScript?: string;
  horrorReferenceId?: string;
  scenes?: Scene[];
  storyBible?: StoryBible;
  redditStory?: RedditStoryPayload;
  horrorReference?: HorrorReferencePayload;
  voiceOverride?: { model?: string; voice?: string; format?: "mp3" | "pcm" };
  narrationVoice?: { model?: string; voice?: string; format?: "mp3" | "pcm" };
  voiceVariants?: VoiceVariant[];
  editDraft?: ReelEditDraft;
  thumbnailDraft?: ThumbnailDraft;
  shortsCover?: {
    imageUrl?: string;
    sourceType: "reddit_title_card" | "scene" | "video_frame";
    sceneIndex?: number;
    atSeconds?: number;
    placement: "opening" | "source_scene";
    holdSeconds?: number;
    editorState?: Record<string, unknown>;
    sourceFingerprint?: string;
    updatedAt?: string;
  };
  thumbnailSceneIndex?: number;
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

export interface RedditStoryPayload {
  title: string;
  body: string;
  source?: "llm" | "hybrid" | "verbatim";
  genre?: string;
  subreddit?: string;
  author?: string;
  cardUsername?: string;
  upvotes?: number;
  comments?: number;
  ageHours?: number;
  seedTitle?: string;
  seedUrl?: string;
  partNumber?: number;
  partCount?: number;
}

export interface HorrorReferencePayload {
  referenceId?: string;
  title: string;
  author?: string;
  sourceUrl: string;
  license?: "public_domain" | "unknown";
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
  outro?: OutroSettings;
  thumbnailMode?: "frame" | "ai";
  imageModel?: string;
  artStyleId?: string;
  motionMode?: MotionMode;
  editEffects?: EditEffects;
  presetId?: string;
  pipelineMode?: "auto" | "review";
  providedScript?: string;
  horrorReferenceId?: string;
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
  code?: string;
}

export const FFMPEG_UNAVAILABLE = "FFMPEG_UNAVAILABLE";

const FFMPEG_UNAVAILABLE_RE =
  /ffmpeg is not installed|missing libass|bundled caption fonts|ffmpeg required|ffmpeg is not available/i;

export const DEFAULT_FFMPEG_FIX_HINTS = [
  "Install FFmpeg (macOS: brew install ffmpeg).",
  "Or set FFMPEG_PATH in server/.env, then restart the API server.",
] as const;

export interface FfmpegCapability {
  ok: boolean;
  code?: string;
  ffmpegPath: string;
  ffmpegOk: boolean;
  hasAssFilter: boolean;
  fontsOk: boolean;
  fontCount: number;
  fontsDir: string;
  version?: string;
  message: string;
  fixHints: string[];
}

export class ApiError extends Error {
  readonly code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

/** Carries the capability snapshot so UI can show the modal without a second round-trip. */
export class FfmpegUnavailableApiError extends ApiError {
  readonly capability: FfmpegCapability;
  constructor(capability: FfmpegCapability) {
    super(capability.message, capability.code ?? FFMPEG_UNAVAILABLE);
    this.name = "FfmpegUnavailableApiError";
    this.capability = capability;
  }
}

export function isFfmpegUnavailableError(error: unknown): boolean {
  return (
    error instanceof FfmpegUnavailableApiError ||
    (error instanceof ApiError && error.code === FFMPEG_UNAVAILABLE) ||
    (error instanceof Error && FFMPEG_UNAVAILABLE_RE.test(error.message))
  );
}

/** Prefer the capability attached to the error; otherwise build a minimal fallback. */
export function ffmpegBlockFromError(error: unknown): FfmpegCapability | undefined {
  if (!isFfmpegUnavailableError(error)) return undefined;
  if (error instanceof FfmpegUnavailableApiError) return error.capability;
  return {
    ok: false,
    code: FFMPEG_UNAVAILABLE,
    ffmpegPath: "ffmpeg",
    ffmpegOk: false,
    hasAssFilter: false,
    fontsOk: false,
    fontCount: 0,
    fontsDir: "",
    message: error instanceof Error ? error.message : "FFmpeg is not available on this device",
    fixHints: [...DEFAULT_FFMPEG_FIX_HINTS],
  };
}

function throwApiFailure(json: ApiResponse<unknown>, status: number): never {
  const message = json.error ?? `Request failed: ${status}`;
  if (json.code === FFMPEG_UNAVAILABLE) {
    throw new FfmpegUnavailableApiError({
      ok: false,
      code: FFMPEG_UNAVAILABLE,
      ffmpegPath: "ffmpeg",
      ffmpegOk: false,
      hasAssFilter: false,
      fontsOk: false,
      fontCount: 0,
      fontsDir: "",
      message,
      fixHints: [...DEFAULT_FFMPEG_FIX_HINTS],
    });
  }
  throw new ApiError(message, json.code);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...init?.headers },
      ...init,
    });
    const json = (await res.json()) as ApiResponse<T>;
    if (!res.ok || !json.success) throwApiFailure(json, res.status);
    return json.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.message !== "Failed to fetch") throw error;
    throw new Error(`API unavailable at ${API_BASE}. Start the server or set VITE_API_BASE_URL.`);
  }
}

export async function listReels(): Promise<Reel[]> {
  return request<Reel[]>("/reels?limit=40");
}

export async function listReelSeries(seriesId: string): Promise<Reel[]> {
  return request<Reel[]>(`/reels/series/${encodeURIComponent(seriesId)}`);
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

export function mediaUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${SERVER_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
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

export type ThumbnailAspectRatio = "16:9" | "9:16" | "1:1";

export async function useFrameAsThumbnail(
  id: string,
  atSeconds: number,
  aspectRatio?: ThumbnailAspectRatio
): Promise<ReelReview> {
  return request<ReelReview>(`/reels/${id}/review/thumbnail/frame`, {
    method: "POST",
    body: JSON.stringify({ atSeconds, aspectRatio }),
  });
}

export async function useSceneImageAsThumbnail(
  id: string,
  sceneIndex: number,
  aspectRatio?: ThumbnailAspectRatio
): Promise<ReelReview> {
  return request<ReelReview>(`/reels/${id}/review/thumbnail/scene`, {
    method: "POST",
    body: JSON.stringify({ sceneIndex, aspectRatio }),
  });
}

export async function previewFrameThumbnail(
  id: string,
  atSeconds: number,
  aspectRatio?: ThumbnailAspectRatio
): Promise<{ imageDataUrl: string }> {
  return request<{ imageDataUrl: string }>(`/reels/${id}/review/thumbnail/frame/preview`, {
    method: "POST",
    body: JSON.stringify({ atSeconds, aspectRatio }),
  });
}

export interface FontOption {
  id: string;
  label: string;
  family: string;
  file: string;
}

export async function listFonts(): Promise<FontOption[]> {
  return request<FontOption[]>("/fonts");
}

/** Absolute URL to a bundled font file (for @font-face in Thumbnail Studio). */
export function fontFileUrl(file: string): string {
  return apiUrl(`/fonts/${encodeURIComponent(file)}`);
}

export type ThumbnailTextEffect =
  | "none"
  | "shadow"
  | "glow"
  | "neon"
  | "impact"
  | "pill"
  | "outline"
  | "pop"
  | "box";

export type ThumbnailPhotoLook =
  | "none"
  | "vivid"
  | "cinematic"
  | "noir"
  | "warm"
  | "cool"
  | "punch";

export interface CustomThumbnailInput {
  atSeconds: number;
  sourceType?: "frame" | "scene";
  sceneIndex?: number;
  text: string;
  aspectRatio?: ThumbnailAspectRatio;
  xPct?: number;
  yPct?: number;
  widthPct?: number;
  align?: "left" | "center" | "right";
  lineHeight?: number;
  effect?: ThumbnailTextEffect;
  photoLook?: ThumbnailPhotoLook;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  outlineColor?: string;
  outlineWidth?: number;
  position?: "top" | "middle" | "bottom";
  uppercase?: boolean;
}

export async function customFrameThumbnail(
  id: string,
  input: CustomThumbnailInput
): Promise<ReelReview> {
  return request<ReelReview>(`/reels/${id}/review/thumbnail/custom`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function previewCustomFrameThumbnail(
  id: string,
  input: CustomThumbnailInput
): Promise<{ imageDataUrl: string }> {
  return request<{ imageDataUrl: string }>(`/reels/${id}/review/thumbnail/custom/preview`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ---- Thumbnail Studio drafts ----

/** Same composition controls, but text is optional (a clean source can be staged). */
export type ThumbnailComposeInput = Omit<CustomThumbnailInput, "text"> & { text?: string };

/** Compose and stage the thumbnail locally on the server — no S3 upload. */
export async function stageThumbnailDraft(id: string, input: ThumbnailComposeInput): Promise<Reel> {
  return request<Reel>(`/reels/${id}/thumbnail-draft`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Aspect-corrected background source for the client-side editor canvas.
 *  Data URLs keep the canvas CORS-clean so it can export a PNG. */
export interface ThumbnailSourceRequest {
  sourceType: "frame" | "scene" | "saved";
  atSeconds?: number;
  sceneIndex?: number;
  aspectRatio?: ThumbnailAspectRatio;
}

export async function getThumbnailSource(
  id: string,
  input: ThumbnailSourceRequest
): Promise<{ imageDataUrl: string }> {
  return request<{ imageDataUrl: string }>(`/reels/${id}/thumbnail-source`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Stage a client-rendered canvas export (WYSIWYG PNG + editor state). */
export async function stageThumbnailDraftImage(
  id: string,
  payload: {
    imageDataUrl: string;
    aspectRatio?: ThumbnailAspectRatio;
    editorState?: Record<string, unknown>;
  }
): Promise<Reel> {
  return request<Reel>(`/reels/${id}/thumbnail-draft/image`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Upload the staged draft to S3 (replacing the previous thumbnail) and clean up local files. */
export async function saveThumbnailDraft(id: string): Promise<Reel> {
  return request<Reel>(`/reels/${id}/thumbnail-draft/save`, { method: "POST" });
}

/** Delete the staged draft's local files without touching the saved thumbnail. */
export async function discardThumbnailDraft(id: string): Promise<Reel> {
  return request<Reel>(`/reels/${id}/thumbnail-draft/discard`, { method: "POST" });
}

export async function saveShortsCover(id: string, payload: {
  imageDataUrl: string;
  sourceType: "reddit_title_card" | "scene" | "video_frame";
  sceneIndex?: number;
  atSeconds?: number;
  placement?: "opening" | "source_scene";
  holdSeconds?: number;
  editorState?: Record<string, unknown>;
  sourceFingerprint?: string;
}): Promise<Reel> {
  return request<Reel>(`/reels/${id}/shorts-cover`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function clearShortsCover(id: string): Promise<Reel> {
  return request<Reel>(`/reels/${id}/shorts-cover`, { method: "DELETE" });
}

// ---- Studio editing (co-creation) ----

export async function listStylePresets(niche?: string): Promise<StylePreset[]> {
  const q = niche ? `?niche=${encodeURIComponent(niche)}` : "";
  return request<StylePreset[]>(`/style-presets${q}`);
}

export async function updateScene(
  id: string,
  index: number,
  patch: { narration?: string; visualPrompt?: string; motion?: SceneMotion }
): Promise<Reel> {
  return request<Reel>(`/reels/${id}/scenes/${index}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function regenerateScene(
  id: string,
  index: number,
  regenerate: ("image" | "audio")[]
): Promise<Reel> {
  return request<Reel>(`/reels/${id}/scenes/${index}/regenerate`, {
    method: "POST",
    body: JSON.stringify({ regenerate }),
  });
}

export async function addScene(
  id: string,
  input: { narration: string; visualPrompt?: string; atIndex?: number }
): Promise<Reel> {
  return request<Reel>(`/reels/${id}/scenes`, { method: "POST", body: JSON.stringify(input) });
}

export async function removeScene(id: string, index: number): Promise<Reel> {
  return request<Reel>(`/reels/${id}/scenes/${index}`, { method: "DELETE" });
}

export async function reorderScenes(id: string, order: number[]): Promise<Reel> {
  return request<Reel>(`/reels/${id}/scenes/reorder`, {
    method: "POST",
    body: JSON.stringify({ order }),
  });
}

export interface ReelSettingsInput {
  thumbnailSceneIndex?: number;
  artStyleId?: string;
  motionMode?: MotionMode;
  imageModel?: string;
  horrorAudioKey?: string;
  horrorReferenceId?: string;
  gameplayKey?: string;
  outroChannelId?: string;
  outro?: OutroSettings;
  voice?: { model?: string; voice?: string; format?: "mp3" | "pcm" };
  audioPost?: AudioPost;
  editEffects?: EditEffects;
}

export async function updateReelSettings(id: string, patch: ReelSettingsInput): Promise<Reel> {
  return request<Reel>(`/reels/${id}/settings`, { method: "PUT", body: JSON.stringify(patch) });
}

export async function updateCaptions(id: string, patch: CaptionStyle): Promise<Reel> {
  return request<Reel>(`/reels/${id}/captions`, { method: "PUT", body: JSON.stringify(patch) });
}

export interface RedditCardInput {
  title?: string;
  subreddit?: string;
  cardUsername?: string;
  author?: string;
  ageHours?: number;
  upvotes?: number;
  comments?: number;
}

export async function updateRedditCard(id: string, patch: RedditCardInput): Promise<Reel> {
  return request<Reel>(`/reels/${id}/reddit-card`, { method: "PUT", body: JSON.stringify(patch) });
}

/** Re-render with caption style, upload to S3, and delete the previous output video. */
export async function applyCaptions(id: string, patch: CaptionStyle): Promise<Reel> {
  return request<Reel>(`/reels/${id}/captions/apply`, {
    method: "POST",
    body: JSON.stringify(patch),
  });
}

export async function regenerateReel(
  id: string,
  mode: "render_only" | "assets" | "outro_only" | "composite_only"
): Promise<Reel> {
  return request<Reel>(`/reels/${id}/regenerate`, { method: "POST", body: JSON.stringify({ mode }) });
}

/** Resume a failed produce job — reuses S3 scene assets, re-runs render→upload. */
export async function resumeFailedReel(id: string): Promise<Reel> {
  return request<Reel>(`/reels/${id}/resume`, { method: "POST" });
}

export interface CaptionSmokeCheck {
  id: string;
  ok: boolean;
  detail: string;
}

export interface CaptionSmokeResult {
  success: boolean;
  checks: CaptionSmokeCheck[];
  outputPath?: string;
  filterPreview?: string;
  message: string;
}

/**
 * Front→backend sample: burn ASS captions onto a test clip and verify pixels.
 * Hits GET /api/maintenance/caption-smoke (same checks as `bun run smoke:captions`).
 */
export async function runCaptionSmokeTest(opts?: {
  keepOutput?: boolean;
}): Promise<CaptionSmokeResult> {
  const q = opts?.keepOutput ? "?keepOutput=1" : "";
  const res = await fetch(`${API_BASE}/maintenance/caption-smoke${q}`);
  const json = (await res.json()) as {
    success: boolean;
    message: string;
    result: CaptionSmokeResult;
  };
  if (!res.ok) {
    throw new Error(json.message || `Caption smoke failed: ${res.status}`);
  }
  return json.result;
}

/** Lightweight preflight — call before create / generate / regenerate / resume. */
export async function getFfmpegStatus(): Promise<FfmpegCapability> {
  const res = await fetch(`${API_BASE}/ffmpeg`);
  const json = (await res.json()) as {
    success: boolean;
    data: FfmpegCapability;
    error?: string;
    code?: string;
  };
  if (!json.data) {
    throw new ApiError(json.error ?? "Could not check FFmpeg status", json.code);
  }
  return json.data;
}

/** Throws {@link FfmpegUnavailableApiError} when the server cannot burn captions. */
export async function assertFfmpegReady(): Promise<FfmpegCapability> {
  const status = await getFfmpegStatus();
  if (!status.ok) throw new FfmpegUnavailableApiError(status);
  return status;
}

export async function saveEditDraft(id: string): Promise<Reel> {
  return request<Reel>(`/reels/${id}/edit-draft/save`, { method: "POST" });
}

export async function discardEditDraft(id: string): Promise<Reel> {
  return request<Reel>(`/reels/${id}/edit-draft/discard`, { method: "POST" });
}

export async function approvePlan(id: string): Promise<Reel> {
  return request<Reel>(`/reels/${id}/approve-plan`, { method: "POST" });
}

export async function replanReel(
  id: string,
  patch: { topic?: string; providedScript?: string; horrorReferenceId?: string }
): Promise<Reel> {
  return request<Reel>(`/reels/${id}/replan`, { method: "POST", body: JSON.stringify(patch) });
}
