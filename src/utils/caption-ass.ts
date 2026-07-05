import type { CSSProperties } from "react";
import type { CaptionStyle } from "@/api/reels";

/** Portrait reel caption layout — mirrors server reel-render PlayRes 1080×1920. */
export const CAPTION_PLAY_RES = { W: 1080, H: 1920 } as const;

/** ASS bottom-center — the only vertical alignment we burn. MarginV = px from bottom. */
export const CAPTION_BURN_ALIGNMENT = 2;

/** Quick-position shortcuts (px from bottom of frame, same axis as drag). */
export const CAPTION_POSITION_PRESETS = {
  bottom: 480,
  middle: 960,
  top: 1680,
} as const;

export type CaptionPositionPreset = keyof typeof CAPTION_POSITION_PRESETS;

function clampMarginV(marginV: number): number {
  return Math.round(Math.min(Math.max(marginV, 0), 1900));
}

/** Normalize any stored caption style to the drag/burn coordinate system. */
export function canonicalCaptionStyle(
  style: Partial<CaptionStyle> | undefined,
  defaults: Required<CaptionStyle>,
): Required<CaptionStyle> & { animation: "none" | "pop" } {
  const merged = { ...defaults, ...(style ?? {}) };
  let marginV = merged.marginV ?? defaults.marginV;

  // Saved drag position uses bottom-center — marginV is authoritative.
  if (merged.alignment !== CAPTION_BURN_ALIGNMENT && merged.alignment != null) {
    const band = Math.floor((merged.alignment - 1) / 3);
    if (band === 1) {
      marginV = CAPTION_POSITION_PRESETS.middle;
    } else if (band === 2) {
      marginV = CAPTION_PLAY_RES.H - marginV - (merged.fontSize ?? defaults.fontSize);
    }
  }

  return {
    ...merged,
    alignment: CAPTION_BURN_ALIGNMENT,
    marginV: clampMarginV(marginV),
    animation: merged.animation ?? "none",
  };
}

/** Y of the caption anchor (px from top of preview) for a bottom-anchored marginV. */
export function anchorYFromMarginV(marginV: number, previewHeight: number): number {
  const ratio = marginV / CAPTION_PLAY_RES.H;
  return previewHeight - ratio * previewHeight;
}

/** Drag Y (px from top) → marginV (px from bottom of 1920 frame). */
export function marginVFromDragY(anchorYFromTop: number, previewHeight: number): number {
  const scaleY = CAPTION_PLAY_RES.H / previewHeight;
  const y = Math.min(Math.max(anchorYFromTop, 0), previewHeight);
  return clampMarginV((previewHeight - y) * scaleY);
}

export function captionPreviewPosition(
  marginV: number,
  marginL: number,
  marginR: number,
): CSSProperties {
  const { W, H } = CAPTION_PLAY_RES;
  return {
    left: `${(marginL / W) * 100}%`,
    right: `${(marginR / W) * 100}%`,
    bottom: `${(marginV / H) * 100}%`,
  };
}

export function captionPreviewFontSize(fontSize: number, previewHeight: number): number {
  return (fontSize / CAPTION_PLAY_RES.H) * previewHeight;
}

export function captionStyleForBurn(style: CaptionStyle): CaptionStyle {
  return {
    ...style,
    alignment: CAPTION_BURN_ALIGNMENT,
    marginV: clampMarginV(style.marginV ?? CAPTION_POSITION_PRESETS.bottom),
  };
}

/** Complete style payload for API — merges defaults so no field is omitted. */
export function captionStylePayload(
  style: Partial<CaptionStyle>,
  defaults: Required<CaptionStyle> & { animation: "none" | "pop" },
): CaptionStyle {
  return captionStyleForBurn(canonicalCaptionStyle(style, defaults));
}
