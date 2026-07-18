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
  thumbnailText?: string;
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
  commentPrompt?: string;
  spokenLine?: string;
  title?: string;
  subtitle?: string;
  cta?: string;
  footer?: string;
}

/** One publish destination: a channel + its own outro + its own rendered video. */
export interface ReelDestination {
  id: string;
  platform: "youtube" | "instagram" | "facebook" | "threads";
  channelId: string;
  channelLabel?: string;
  outro?: OutroSettings;
  skipBrandedOutro?: boolean;
  outroAudioUrl?: string;
  outroAudioSignature?: string;
  outputUrl?: string;
  durationAdded?: number;
  status: "pending" | "rendering" | "ready" | "failed";
  error?: string;
  createdAt?: string;
}

export interface DestinationRemovalSummary {
  requested: number;
  deleted: number;
  skipped: number;
  failed: number;
}

export interface Reel {
  _id?: string;
  id?: string;
  niche: string;
  topic: string;
  tier?: "cheap" | "value" | "premium";
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
  outroAudioSignature?: string;
  thumbnailMode?: "frame" | "ai";
  /** Short hook shared by the automatic opening cover and thumbnail. */
  thumbnailHook?: string;
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
    firstCommentStatus?: "pending" | "posted" | "failed" | "skipped";
    firstCommentId?: string;
    firstCommentError?: string;
  };
  instagram?: Array<{
    channelId: string;
    channelLabel?: string;
    status: "pending" | "uploading" | "published" | "failed";
    containerId?: string;
    mediaId?: string;
    url?: string;
    error?: string;
    message?: string;
    updatedAt?: string;
    publishedAt?: string;
    firstCommentStatus?: "pending" | "posted" | "failed" | "skipped";
    firstCommentId?: string;
    firstCommentError?: string;
  }>;
  facebook?: Array<{
    channelId: string;
    channelLabel?: string;
    status: "pending" | "uploading" | "published" | "failed";
    videoId?: string;
    url?: string;
    error?: string;
    message?: string;
    firstCommentStatus?: "pending" | "posted" | "failed" | "skipped";
    updatedAt?: string;
    publishedAt?: string;
  }>;
  threads?: Array<{
    channelId: string;
    channelLabel?: string;
    status: "pending" | "uploading" | "published" | "failed";
    containerId?: string;
    mediaId?: string;
    url?: string;
    error?: string;
    message?: string;
    firstCommentStatus?: "pending" | "posted" | "failed" | "skipped";
    updatedAt?: string;
    publishedAt?: string;
  }>;
  instagramSettings?: {
    caption?: string;
    shareToFeed?: boolean;
    source?: "ai" | "manual" | "fallback";
    generatedAt?: string;
    model?: string;
    /** Creator-only copy for a manually added native Instagram poll. */
    poll?: {
      question?: string;
      optionA?: string;
      optionB?: string;
      source?: "ai" | "manual" | "fallback";
      generatedAt?: string;
      model?: string;
    };
  };
  facebookSettings?: { description?: string };
  threadsSettings?: { text?: string };
  seriesId?: string;
  partNumber?: number;
  partCount?: number;
  createdAt?: string;
  updatedAt?: string;
  gameplayKey?: string;
  horrorAudioKey?: string;
  outroChannelId?: string;
  outroInstagramChannelId?: string;
  outro?: OutroSettings;
  /** Multi-channel destinations — one rendered video per destination. */
  destinations?: ReelDestination[];
  /** Ephemeral response metadata from a destination-delete mutation. */
  lastDestinationRemoval?: {
    destination: { id: string; platform: "youtube" | "instagram" | "facebook" | "threads"; channelId: string; channelLabel?: string };
    cleanup: DestinationRemovalSummary;
  };
  /** Skip multi-part "Stay tuned for part N" (Reddit mid-series only). */
  skipPartOutro?: boolean;
  /** Skip branded channel end card + subscribe TTS. */
  skipBrandedOutro?: boolean;
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
    replacesTitleCard?: boolean;
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

export type UpdateCandidateKind = "embedded_link" | "author_post" | "manual";
export type UpdateDecision = "include" | "candidate" | "rejected";

export interface UpdateCandidate {
  key: string;
  kind: UpdateCandidateKind;
  title: string;
  body: string;
  url: string;
  createdUtc: number;
  matchedSignals: string[];
  signalScore: number;
  aiConfidence?: number;
  aiReason?: string;
  decision: UpdateDecision;
}

export interface UpdateDiscovery {
  scannedAt: string;
  method: "ai" | "signals" | "hybrid";
  candidates: UpdateCandidate[];
  includedKeys: string[];
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
  updateDiscovery?: UpdateDiscovery;
  sourceSegment?: string;
  structureAdvice?: { fingerprint: string };
  structureDecision?: { fingerprint: string; choice: "recommended" | "manual" };
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
  outroInstagramChannelId?: string;
  outro?: OutroSettings;
  /** Multi-channel destinations — one video per destination, each with its own outro. */
  destinations?: { platform: "youtube" | "instagram" | "facebook" | "threads"; channelId: string; outro?: OutroSettings }[];
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
  /** Bank story picked in browse step */
  selectedStoryId?: string;
  /** Live Reddit post picked in browse step (or pasted link) */
  selectedSeedUrl?: string;
  /** Auto-discover the OP's followups/updates (default on for verbatim) */
  fetchUpdates?: boolean;
  /** User-pasted canonical followup URLs, sourced directly */
  manualUpdateUrls?: string[];
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

export interface InstagramChannelOption {
  id: string;
  label: string;
  instagramUserId: string;
  username?: string;
  name?: string;
  profilePictureUrl?: string;
  niches?: string[];
  status: "active" | "needs_reauth" | "disabled";
  lastError?: string;
}

export interface FacebookPageOption {
  id: string;
  label: string;
  pageId: string;
  name?: string;
  category?: string;
  pictureUrl?: string;
  niches?: string[];
  status: "active" | "needs_reauth" | "disabled";
  lastError?: string;
}

export interface ThreadsChannelOption {
  id: string;
  label: string;
  threadsUserId: string;
  username?: string;
  name?: string;
  profilePictureUrl?: string;
  niches?: string[];
  status: "active" | "needs_reauth" | "disabled";
  lastError?: string;
}

export interface OwnPostComment {
  id: string;
  text: string;
  author?: string;
  username?: string;
  publishedAt?: string;
  timestamp?: string;
  likeCount?: number;
  replyCount: number;
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
    const headers = new Headers(init?.headers);
    if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
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
export async function updateYouTubeChannel(id: string, input: { label?: string; privacyStatus?: "private" | "unlisted" | "public"; categoryId?: string; niches?: string[] }): Promise<void> { await request(`/youtube/channels/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) }); }

export async function listInstagramChannels(): Promise<InstagramChannelOption[]> {
  return request<InstagramChannelOption[]>("/instagram/channels");
}
export async function startInstagramChannelConnect(input: { label: string; channelKey?: string; niches?: string[] }): Promise<{ authUrl: string }> {
  return request<{ authUrl: string }>("/instagram/connect/start", { method: "POST", body: JSON.stringify(input) });
}
export async function deleteInstagramChannel(id: string): Promise<void> { await request(`/instagram/channels/${encodeURIComponent(id)}`, { method: "DELETE" }); }
export async function updateInstagramChannel(id: string, input: { label?: string; niches?: string[] }): Promise<void> { await request(`/instagram/channels/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) }); }
export async function distributeReel(id: string, input: { youtubeChannelIds?: string[]; instagramChannelIds?: string[]; forceRepublish?: boolean }): Promise<Reel> {
  return request<Reel>(`/reels/${id}/distribute`, { method: "POST", body: JSON.stringify(input) });
}

// ---- Facebook Reels (owned Pages) ----
export async function listFacebookPages(): Promise<FacebookPageOption[]> {
  return request<FacebookPageOption[]>("/facebook/channels");
}
export async function startFacebookConnect(input: { label: string; channelKey?: string; niches?: string[] }): Promise<{ authUrl: string }> {
  return request<{ authUrl: string }>("/facebook/connect/start", { method: "POST", body: JSON.stringify(input) });
}
export async function deleteFacebookPage(id: string): Promise<void> { await request(`/facebook/channels/${encodeURIComponent(id)}`, { method: "DELETE" }); }
export async function updateFacebookPage(id: string, input: { label?: string; niches?: string[] }): Promise<void> { await request(`/facebook/channels/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) }); }
export async function publishReelToFacebook(reelId: string, channelId: string): Promise<{ facebook: unknown }> {
  return request(`/facebook/reels/${encodeURIComponent(reelId)}/channels/${encodeURIComponent(channelId)}/publish`, { method: "POST" });
}

// ---- Threads (owned profiles) ----
export async function listThreadsChannels(): Promise<ThreadsChannelOption[]> {
  return request<ThreadsChannelOption[]>("/threads/channels");
}
export async function startThreadsConnect(input: { label: string; channelKey?: string; niches?: string[] }): Promise<{ authUrl: string }> {
  return request<{ authUrl: string }>("/threads/connect/start", { method: "POST", body: JSON.stringify(input) });
}
export async function deleteThreadsChannel(id: string): Promise<void> { await request(`/threads/channels/${encodeURIComponent(id)}`, { method: "DELETE" }); }
export async function updateThreadsChannel(id: string, input: { label?: string; niches?: string[] }): Promise<void> { await request(`/threads/channels/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) }); }
export async function publishReelToThreads(reelId: string, channelId: string): Promise<{ threads: unknown }> {
  return request(`/threads/reels/${encodeURIComponent(reelId)}/channels/${encodeURIComponent(channelId)}/publish`, { method: "POST" });
}

// ---- Own-post comment layer (own-media only) ----
export async function listYouTubeComments(reelId: string, channelId: string, limit?: number): Promise<OwnPostComment[]> {
  const q = new URLSearchParams({ channelId, ...(limit ? { limit: String(limit) } : {}) });
  return request<OwnPostComment[]>(`/youtube/reels/${encodeURIComponent(reelId)}/comments?${q}`);
}
export async function postYouTubeFirstComment(reelId: string, channelId?: string): Promise<{ commentId: string }> {
  return request(`/youtube/reels/${encodeURIComponent(reelId)}/first-comment`, { method: "POST", body: JSON.stringify({ channelId }) });
}
export async function replyToYouTubeComment(channelId: string, commentId: string, message: string): Promise<{ replyId: string }> {
  return request(`/youtube/comments/reply`, { method: "POST", body: JSON.stringify({ channelId, commentId, message }) });
}
export async function listInstagramComments(reelId: string, channelId: string, limit?: number): Promise<OwnPostComment[]> {
  const q = new URLSearchParams({ channelId, ...(limit ? { limit: String(limit) } : {}) });
  return request<OwnPostComment[]>(`/instagram/reels/${encodeURIComponent(reelId)}/comments?${q}`);
}
export async function postInstagramFirstComment(reelId: string, channelId: string): Promise<{ commentId: string }> {
  return request(`/instagram/reels/${encodeURIComponent(reelId)}/channels/${encodeURIComponent(channelId)}/first-comment`, { method: "POST" });
}
export async function replyToInstagramComment(channelId: string, commentId: string, message: string): Promise<{ replyId: string }> {
  return request(`/instagram/comments/reply`, { method: "POST", body: JSON.stringify({ channelId, commentId, message }) });
}

export async function createReel(input: CreateReelInput): Promise<{ id: string; parts: Reel[] }> {
  return request("/reels", { method: "POST", body: JSON.stringify(input) });
}

export async function getReel(id: string): Promise<Reel> {
  // Studio uses this after metadata writes as an authoritative readback. Do
  // not allow a browser cache to turn a completed save into a stale snapshot.
  return request<Reel>(`/reels/${id}/status`, { cache: "no-store" });
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

/** Generates only a new YouTube Shorts title and description. It does not
 * change upload tags, thumbnail, Instagram copy, or rendered media. */
export async function regenerateReviewCopy(id: string): Promise<Reel> {
  return request<Reel>(`/reels/${id}/review/copy`, { method: "POST" });
}

/** Generates only the platform-specific Instagram caption; it does not change
 * YouTube review metadata or re-render the video. */
export async function regenerateInstagramCaption(id: string): Promise<Reel> {
  return request<Reel>(`/reels/${id}/instagram-caption`, { method: "POST" });
}

/** Generates a creator-only draft for a native poll sticker. It is never sent
 * to Meta's Reel publishing endpoint. */
export async function regenerateInstagramPollSuggestion(id: string): Promise<Reel> {
  return request<Reel>(`/reels/${id}/instagram-poll`, { method: "POST" });
}

/** Generates compact thumbnail overlay copy without rendering an image. */
export async function regenerateThumbnailText(id: string): Promise<Reel> {
  return request<Reel>(`/reels/${id}/review/thumbnail-text`, { method: "POST" });
}

/** Generates one short, story-and-part-specific question for the branded outro.
 * It only invalidates affected outro outputs; body scenes and narration stay cached. */
export async function regenerateOutroCommentPrompt(
  id: string,
  scope: "primary" | "inheriting" | "all" = "inheriting",
): Promise<Reel> {
  return request<Reel>(`/reels/${id}/outro/comment-prompt`, {
    method: "POST",
    body: JSON.stringify({ scope }),
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

/** Delete one part of a series; the backend renumbers the survivors and returns
 *  the remaining part ids in order (empty when the whole reel is gone). */
export async function deleteSeriesPart(
  id: string,
): Promise<{ seriesId?: string; remainingIds: string[] }> {
  return request(`/reels/${id}/part`, { method: "DELETE" });
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
  cleanGameplay?: boolean;
  includeTitleCard?: boolean;
  includeShortsCover?: boolean;
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
  replacesTitleCard?: boolean;
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
  outroInstagramChannelId?: string;
  outro?: OutroSettings;
  skipPartOutro?: boolean;
  skipBrandedOutro?: boolean;
  voice?: { model?: string; voice?: string; format?: "mp3" | "pcm" };
  voiceScope?: "reel" | "series";
  audioPost?: AudioPost;
  editEffects?: EditEffects;
  instagram?: {
    caption?: string;
    shareToFeed?: boolean;
    poll?: { question?: string; optionA?: string; optionB?: string };
  };
  facebook?: { description?: string };
  threads?: { text?: string };
}

export async function updateReelSettings(id: string, patch: ReelSettingsInput): Promise<Reel> {
  return request<Reel>(`/reels/${id}/settings`, { method: "PUT", body: JSON.stringify(patch) });
}

export interface WordAlignmentStatus {
  enabled: boolean;
  ready: boolean;
  detail: string;
}

export async function getWordAlignmentStatus(): Promise<WordAlignmentStatus> {
  return request<WordAlignmentStatus>("/maintenance/word-alignment");
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

/** Rebuild outro card/video from current account data. The backend reuses
 * cached outro audio when the narration text and TTS choice still match. */
export async function retryReelOutro(
  id: string,
  retry: { scope: "all" | "primary" | "destination"; destinationId?: string },
): Promise<Reel> {
  return request<Reel>(`/reels/${id}/outro/retry`, {
    method: "POST",
    body: JSON.stringify(retry),
  });
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
  patch: {
    topic?: string;
    providedScript?: string;
    horrorReferenceId?: string;
    selectedStoryId?: string;
    selectedSeedUrl?: string;
  }
): Promise<Reel> {
  return request<Reel>(`/reels/${id}/replan`, { method: "POST", body: JSON.stringify(patch) });
}

export async function replanReelSeries(
  id: string,
  patch: {
    selectedStoryId?: string;
    selectedSeedUrl?: string;
    parts?: "off" | "auto" | number;
  }
): Promise<Reel> {
  return request<Reel>(`/reels/${id}/replan-series`, { method: "POST", body: JSON.stringify(patch) });
}

/** Re-scan the OP's followups/updates; optionally add a manual followup link. */
export async function rescanReelUpdates(id: string, manualUrl?: string): Promise<Reel> {
  return request<Reel>(`/reels/${id}/updates/rescan`, {
    method: "POST",
    body: JSON.stringify(manualUrl ? { manualUrl } : {}),
  });
}

/** Fold the chosen updates into the story and recompute parts. */
export async function applyReelUpdates(
  id: string,
  patch: { includedKeys: string[]; mode: "append" | "recut" }
): Promise<Reel> {
  return request<Reel>(`/reels/${id}/updates`, { method: "PUT", body: JSON.stringify(patch) });
}

/** Manually restructure the Reddit series into a chosen number of parts. */
export async function restructureSeriesParts(id: string, parts: number | "auto"): Promise<Reel> {
  return request<Reel>(`/reels/${id}/restructure-parts`, {
    method: "POST",
    body: JSON.stringify({ parts }),
  });
}

export interface SeriesStructureAdvice {
  wordCount: number;
  sentenceCount: number;
  estimatedDurationSeconds: number;
  minimumParts: number;
  recommendedParts: number;
  currentParts: number;
  reason: string;
  hasWeakBreaks: boolean;
  breaks: Array<{
    partNumber: number;
    sentenceNumber: number;
    ending: string;
    score: number;
    quality: "strong" | "serviceable" | "weak";
    rationale?: string;
  }>;
}

/** Paid LLM editorial recommendation, cached until the assembled story changes. */
export async function getSeriesStructureAdvice(id: string): Promise<SeriesStructureAdvice> {
  return request<SeriesStructureAdvice>(`/reels/${id}/structure-advice`);
}

/** Explicitly accept the AI plan or retain the current manual structure. */
export async function chooseSeriesStructure(
  id: string,
  choice: "recommended" | "manual"
): Promise<Reel> {
  return request<Reel>(`/reels/${id}/structure-decision`, {
    method: "POST",
    body: JSON.stringify({ choice }),
  });
}

export interface ResolvedStory {
  title: string;
  author?: string;
  subreddit?: string;
  url: string;
  wordCount: number;
  updateCandidates: number;
  updateDiscovery?: UpdateDiscovery;
}

/** Resolve a pasted Reddit permalink / share link into a source-post preview. */
export async function resolveStory(url: string, fetchUpdates?: boolean): Promise<ResolvedStory> {
  return request<ResolvedStory>(`/stories/resolve`, {
    method: "POST",
    body: JSON.stringify({ url, fetchUpdates }),
  });
}

/** Move one spoken line across the seam between this part and the next.
 *  Returns the updated current part. */
export async function moveSeriesBoundary(
  id: string,
  direction: "pushLastToNext" | "pullFirstFromNext",
): Promise<Reel> {
  return request<Reel>(`/reels/${id}/move-boundary`, {
    method: "POST",
    body: JSON.stringify({ direction }),
  });
}

/** Merge this part's lines into the previous part and delete this part.
 *  Returns the previous part that absorbed the content. */
export async function mergePartIntoPrevious(id: string): Promise<Reel> {
  return request<Reel>(`/reels/${id}/merge-into-previous`, { method: "POST" });
}

// ---- Multi-channel destinations ----

export async function listReelDestinations(id: string): Promise<ReelDestination[]> {
  return request<ReelDestination[]>(`/reels/${id}/destinations`);
}

/** Add a channel destination. Renders its outro now when the reel is produced. */
export async function addReelDestination(
  id: string,
  input: {
    platform: "youtube" | "instagram" | "facebook" | "threads";
    channelId: string;
    outro?: OutroSettings;
    scope?: "reel" | "series";
  },
): Promise<Reel> {
  return request<Reel>(`/reels/${id}/destinations`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Select a connected account as primary. Keeping the prior primary demotes it
 * to an extra destination; removing it deletes only this reel/story's media. */
export async function setReelPrimaryDestination(
  id: string,
  input: {
    platform: "youtube" | "instagram";
    channelId: string;
    previousPrimary: "keep" | "remove";
    scope: "reel" | "series";
  },
): Promise<Reel> {
  return request<Reel>(`/reels/${id}/destinations/primary`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function removeReelDestination(id: string, destId: string): Promise<Reel> {
  const result = await request<{
    reel: Reel;
    destination: { id: string; platform: "youtube" | "instagram" | "facebook" | "threads"; channelId: string; channelLabel?: string };
    cleanup: DestinationRemovalSummary;
  }>(`/reels/${id}/destinations/${destId}`, { method: "DELETE" });
  // The Studio action runner still receives a normal Reel, while the panel can
  // display this one-shot verified cleanup outcome without another API call.
  return Object.assign(result.reel, { lastDestinationRemoval: result });
}

/** Update one destination's outro copy; re-renders that outro when produced. */
export async function updateReelDestinationOutro(
  id: string,
  destId: string,
  outro: OutroSettings,
): Promise<Reel> {
  return request<Reel>(`/reels/${id}/destinations/${destId}/outro`, {
    method: "PUT",
    body: JSON.stringify({ outro }),
  });
}
