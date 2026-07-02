import type { Reel, ReelReview } from "@/api/reels";
import { STAGE_PROGRESS_THRESHOLDS } from "@/constants/reels";

export function reelId(reel?: Reel): string {
  return reel?.id ?? reel?._id ?? "";
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
