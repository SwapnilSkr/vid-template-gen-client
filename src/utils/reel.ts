import type { Reel, ReelReview } from "@/api/reels";
import { STAGE_PROGRESS_THRESHOLDS } from "@/constants/reels";

/** Pipeline statuses that mean a produce/plan job is still running. */
export const REEL_ACTIVE_STATUSES: Reel["status"][] = [
  "pending",
  "planning",
  "generating_assets",
  "generating_audio",
  "aligning",
  "rendering",
  "uploading",
];

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

/** Whether a gameplay re-render will spend OpenRouter TTS credits. */
export function gameplayRerenderCostsCredits(reel?: Reel | null): boolean {
  return reel?.strategy === "gameplay_overlay";
}

export function formatLabel(value?: string) {
  if (value === "2d_comic_horror") return "2D Comic Horror";
  return value ? value.replace(/_/g, " ") : "reddit";
}

export function isStageDone(reel: Reel | undefined, index: number) {
  if (!reel) return false;
  if (reel.status === "completed") return true;
  return reel.progress >= STAGE_PROGRESS_THRESHOLDS[index];
}

export function reelTopStatus(reel?: Reel, review?: ReelReview) {
  if (!reel) return "No reel selected";
  if (reel.status !== "completed") return `${reel.status} · ${reel.progress}%`;
  if (reel.youtube?.status === "published") return "Published";
  if (review?.status === "approved") return "Approved";
  return "In Review";
}

export function parsePartsValue(value: string): "off" | "auto" | number {
  if (value === "off" || value === "auto") return value;
  return Number(value);
}
