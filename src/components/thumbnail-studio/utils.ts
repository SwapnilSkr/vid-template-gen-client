import type { Reel } from "@/api/reels";
import {
  defaultDoc,
  docFromLegacyDraftInput,
  reviveDoc,
  type ThumbDoc,
} from "@/components/thumbnail-editor/doc";

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

/** Browser session cache for the Shorts cover editor canvas. */
export function shortsSessionDocKey(reelId: string, gameplayOverlay: boolean): string {
  return `${sessionDocKey(reelId)}${gameplayOverlay ? ":shorts-overlay-v2" : ":shorts"}`;
}

export function clearShortsSessionDoc(reelId: string, gameplayOverlay: boolean): void {
  try {
    sessionStorage.removeItem(shortsSessionDocKey(reelId, gameplayOverlay));
  } catch {
    /* private mode / quota */
  }
}

export function hasSavedShortsCover(reel: Reel): boolean {
  return Boolean(reel.shortsCover?.imageUrl || reel.shortsCover?.editorState);
}

/** Rebuild the editor doc from the last server/S3 Shorts cover save. */
export function buildDocFromSavedShortsCover(reel: Reel): ThumbDoc | undefined {
  const cover = reel.shortsCover;
  if (!cover?.imageUrl && !cover?.editorState) return undefined;

  if (cover.editorState) {
    const revived = reviveDoc(cover.editorState) ?? docFromLegacyDraftInput(cover.editorState, "9:16");
    if (revived) return revived;
  }

  if (!cover.imageUrl) return undefined;

  const doc = defaultDoc("9:16", defaultTitleText(reel));
  if (cover.sourceType === "video_frame" || cover.sourceType === "reddit_title_card") {
    doc.background.sourceType = "frame";
    if (cover.atSeconds !== undefined) doc.background.atSeconds = cover.atSeconds;
  } else if (cover.sourceType === "scene" && cover.sceneIndex !== undefined) {
    doc.background.sourceType = "scene";
    doc.background.sceneIndex = cover.sceneIndex;
  } else if (reel.strategy === "gameplay_overlay" || !reel.scenes?.length) {
    doc.background.sourceType = "frame";
  }
  return doc;
}

