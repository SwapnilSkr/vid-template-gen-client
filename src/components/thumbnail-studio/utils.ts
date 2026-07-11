import type { Reel } from "@/api/reels";

export const AI_PROMPT_CHIPS = [
  "close-up face, shocked expression",
  "dramatic rim lighting, high contrast",
  "dark forest at night, fog, single light source",
  "vibrant colors, cinematic depth of field",
];

export function defaultTitleText(reel: Reel): string {
  return (
    reel.review?.title?.trim() ||
    reel.redditStory?.title?.trim() ||
    reel.title?.trim() ||
    reel.hook?.trim() ||
    ""
  );
}

export function sessionDocKey(reelId: string): string {
  return `thumb-studio-doc:${reelId}`;
}

