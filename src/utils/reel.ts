import type { Reel, ReelReview, ReelStatus } from "@/api/reels";

/** Pipeline statuses that mean a produce/plan job is still running. */
export const REEL_ACTIVE_STATUSES: ReelStatus[] = [
  "pending",
  "planning",
  "generating_assets",
  "generating_audio",
  "aligning",
  "rendering",
  "uploading",
];

export const REEL_POLL_MS = 3000;
export const REEL_ASSET_POLL_MS = 1500;
export const REEL_SETTLE_MS = 2000;

/** Matches "Image 3/9" / "Narration 2/9" from the produce worker. */
const PRODUCING_SCENE_RE = /(?:Image|Narration)\s+(\d+)\//;

export function reelId(reel?: Reel): string {
  return reel?.id ?? reel?._id ?? "";
}

/**
 * True while any background job for this reel may still change fields the UI
 * shows — produce pipeline, revoice variants, or YouTube publish. These last
 * two leave `status` as `completed`, so status-only polling misses them.
 */
export function reelNeedsPolling(reel?: Reel | null): boolean {
  if (!reel) return false;
  if (REEL_ACTIVE_STATUSES.includes(reel.status)) return true;
  if (reel.voiceVariants?.some((v) => v.status === "pending")) return true;
  const yt = reel.youtube?.status;
  if (yt === "pending" || yt === "uploading") return true;
  return false;
}

/**
 * True while the studio should block further edits / re-renders. Broader than
 * produce-only: includes pending revoice and YouTube upload so the UI can't
 * stack another paid job on top.
 */
export function reelStudioLocked(reel?: Reel | null): boolean {
  return reelNeedsPolling(reel);
}

export function isAssetStreamingStatus(status?: ReelStatus): boolean {
  return status === "generating_assets" || status === "generating_audio";
}

/** 0-based scene index currently being produced, if `currentStep` names one. */
export function producingSceneIndex(currentStep?: string): number | undefined {
  if (!currentStep) return undefined;
  const match = PRODUCING_SCENE_RE.exec(currentStep);
  if (!match) return undefined;
  const oneBased = Number(match[1]);
  return Number.isFinite(oneBased) && oneBased > 0 ? oneBased - 1 : undefined;
}

export function formatReelStatus(status: ReelStatus): string {
  return status.replace(/_/g, " ");
}

/** Chip-friendly label (plan_review → "awaiting review"). */
export function reelStatusLabel(status: ReelStatus): string {
  if (status === "plan_review") return "awaiting review";
  return formatReelStatus(status);
}

/** Whether a gameplay re-render will spend OpenRouter TTS credits.
 *  Once title + sentence audio are cached on the reel, render-only is free TTS. */
export function gameplayRerenderCostsCredits(reel?: Reel | null): boolean {
  if (reel?.strategy !== "gameplay_overlay") return false;
  return !gameplayNarrationCacheReady(reel);
}

/** True when Reddit narration segments are cached and can be reused. */
export function gameplayNarrationCacheReady(reel?: Reel | null): boolean {
  if (!reel || reel.strategy !== "gameplay_overlay") return false;
  if (!reel.titleAudioUrl) return false;
  const scenes = reel.scenes ?? [];
  if (!scenes.length) return false;
  return scenes.every((scene) => Boolean(scene.audioUrl));
}

/** Prefer outro-only when a body-without-outro artifact exists. */
export function canOutroOnlyRerender(reel?: Reel | null): boolean {
  return Boolean(reel?.bodyVideoUrl);
}

/** Prefer composite-only (no TTS / no Ken Burns) when caches allow. */
export function canCompositeOnlyRerender(reel?: Reel | null): boolean {
  if (!reel) return false;
  if (reel.strategy === "gameplay_overlay") return gameplayNarrationCacheReady(reel);
  return Boolean(reel.assemblyVideoUrl);
}

/** How many gameplay TTS segments are still missing (title + sentences + part-outro). */
export function gameplayMissingTtsSegmentCount(reel?: Reel | null): number {
  if (!reel || reel.strategy !== "gameplay_overlay") return 0;
  let missing = 0;
  if (!reel.titleAudioUrl) missing += 1;
  for (const scene of reel.scenes ?? []) {
    if (!scene.audioUrl) missing += 1;
  }
  const partNumber = reel.partNumber ?? reel.redditStory?.partNumber ?? 1;
  const partCount = reel.partCount ?? reel.redditStory?.partCount ?? 1;
  if (partNumber < partCount && !reel.skipPartOutro && !reel.partOutroAudioUrl) missing += 1;
  return missing;
}

export function formatLabel(value?: string) {
  if (value === "2d_comic_horror") return "2D Comic Horror";
  return value ? value.replace(/_/g, " ") : "reddit";
}

/** Highest timeline stage index fully complete for this status (-1 = none). */
function stageDoneFloor(status: ReelStatus): number {
  switch (status) {
    case "pending":
      return -1;
    case "planning":
      return 0;
    case "plan_review":
    case "generating_assets":
    case "generating_audio":
      return 1;
    case "aligning":
    case "rendering":
      return 2;
    case "uploading":
      return 3;
    case "completed":
      return 4;
    default:
      return -1;
  }
}

/** Timeline stage in progress (-1 when paused at plan_review / idle / failed). */
function generationStageIndex(status: ReelStatus): number {
  switch (status) {
    case "pending":
      return 0;
    case "planning":
      return 1;
    case "generating_assets":
    case "generating_audio":
      return 2;
    case "aligning":
    case "rendering":
    case "uploading":
      return 3;
    case "completed":
      return 4;
    default:
      return -1;
  }
}

export function isStageDone(reel: Reel | undefined, index: number) {
  if (!reel) return false;
  return index <= stageDoneFloor(reel.status);
}

export function isStageActive(reel: Reel | undefined, index: number) {
  if (!reel) return false;
  return generationStageIndex(reel.status) === index;
}

export function reelProgressLabel(reel: Reel): string {
  const status = formatReelStatus(reel.status);
  const step = reel.currentStep?.trim();
  return step ? `${status} · ${reel.progress}% · ${step}` : `${status} · ${reel.progress}%`;
}

export function reelTopStatus(reel?: Reel, review?: ReelReview) {
  if (!reel) return "No reel selected";
  if (reel.status === "failed") {
    return reel.error?.trim() ? `failed · ${reel.error}` : "failed";
  }
  if (reel.status !== "completed") return reelProgressLabel(reel);
  if (reel.youtube?.status === "published") return "Published";
  if (review?.status === "approved") return "Approved";
  return "In Review";
}

export function parsePartsValue(value: string): "off" | "auto" | number {
  if (value === "off" || value === "auto") return value;
  return Number(value);
}

/** Human copy shown on the create button while POST /reels is in flight. */
export function createReelLoadingLabel(input: {
  niche: string;
  parts?: "off" | "auto" | number | string;
}): string {
  const isSeries = (input.parts ?? "off") !== "off";
  if (input.niche.startsWith("reddit")) {
    return isSeries ? "Writing Reddit series…" : "Writing Reddit story…";
  }
  if (input.niche.startsWith("horror")) {
    return isSeries ? "Planning horror series…" : "Queuing horror reel…";
  }
  return isSeries ? "Planning series…" : "Queuing reel…";
}

/** Supporting banner copy under the create button while POST is in flight. */
export function createReelLoadingHint(input: {
  niche: string;
  parts?: "off" | "auto" | number | string;
}): string {
  if (input.niche.startsWith("reddit")) {
    return "Story generation runs on the server before the reel is queued — this can take a minute. Progress continues on the dashboard after create.";
  }
  if ((input.parts ?? "off") !== "off") {
    return "Series planning runs on the server before parts are queued — hang tight.";
  }
  return "Queuing the reel. Open the dashboard after create to watch plan/produce progress.";
}
