import type { Reel } from "@/api/reels";
import {
  defaultDoc,
  defaultRedditShortsCoverDoc,
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
    reel.review?.thumbnailText?.trim() ||
    reel.thumbnailHook?.trim() ||
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
  return `${sessionDocKey(reelId)}${gameplayOverlay ? ":shorts-overlay-v3" : ":shorts"}`;
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

  // Rebuild any automatic opening cover from the current shared hook without
  // touching creator-made covers. This clears legacy source-title text while
  // preserving the Reddit card's separate, verbatim title treatment.
  if (
    reel.strategy === "gameplay_overlay" &&
    (
      cover.sourceFingerprint?.startsWith("reddit-opening-cover:") ||
      (cover.sourceType === "reddit_title_card" && cover.replacesTitleCard === true)
    )
  ) {
    return defaultRedditShortsCoverDoc(defaultTitleText(reel));
  }

  if (cover.editorState) {
    const revived = reviveDoc(cover.editorState) ?? docFromLegacyDraftInput(cover.editorState, "9:16");
    if (revived) return revived;
  }

  if (!cover.imageUrl) return undefined;

  const doc = reel.strategy === "gameplay_overlay"
    ? defaultRedditShortsCoverDoc(defaultTitleText(reel))
    : defaultDoc("9:16", defaultTitleText(reel));
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
