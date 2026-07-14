import type { OutroSettings, Reel, YouTubeChannelOption } from "@/api/reels";
import { CAPTION_DEFAULTS } from "@/components/studio/constants";
import { canonicalCaptionStyle } from "@/utils/caption-ass";

export function reelKey(reel: Reel): string {
  return reel._id ?? reel.id ?? "";
}


export function compactOutroSettings(outro: OutroSettings): OutroSettings {
  return Object.fromEntries(
    Object.entries(outro)
      .map(([key, value]) => [key, value?.trim()])
      .filter(([, value]) => Boolean(value)),
  ) as OutroSettings;
}

export const DEFAULT_OUTRO_COMMENT_PROMPT =
  "What would you have done in this situation?";

export function defaultOutroCta(platform: "youtube" | "instagram"): "SUBSCRIBE" | "FOLLOW" {
  return platform === "instagram" ? "FOLLOW" : "SUBSCRIBE";
}

export function defaultOutroSpokenLine(
  platform: "youtube" | "instagram",
  channelName = "Channel Name",
): string {
  return platform === "instagram"
    ? `Follow ${channelName} for more stories.`
    : `Subscribe to ${channelName} for more stories.`;
}

export function channelDisplayName(channel: YouTubeChannelOption): string {
  return channel.googleChannelTitle || channel.label;
}

export function channelPurpose(channel: YouTubeChannelOption): string {
  return channel.niches?.length ? channel.niches.join(", ") : "general";
}


export function normalizeHexColor(value: string | undefined, fallback: string): string {
  const match = /^#?([0-9a-fA-F]{6})$/.exec((value ?? "").trim());
  return match ? `#${match[1].toLowerCase()}` : fallback;
}

export function captionPreviewWords(
  reel: Reel,
  chunkSize: number,
  uppercase: boolean,
): string[] {
  const raw =
    reel.scenes?.find((s) => s.narration?.trim())?.narration ??
    reel.title ??
    "Sample caption preview";
  const words = raw.trim().split(/\s+/).filter(Boolean);
  const chunk = words.slice(0, Math.max(1, chunkSize));
  return uppercase ? chunk.map((word) => word.toUpperCase()) : chunk;
}

export function captionStyleFromReel(captionStyle: Reel["captionStyle"]) {
  const next = canonicalCaptionStyle(captionStyle, {
    ...CAPTION_DEFAULTS,
    animation: CAPTION_DEFAULTS.animation,
  });
  return {
    ...next,
    primaryColor: normalizeHexColor(next.primaryColor, CAPTION_DEFAULTS.primaryColor),
    activeColor: normalizeHexColor(next.activeColor, CAPTION_DEFAULTS.activeColor),
    outlineColor: normalizeHexColor(next.outlineColor, CAPTION_DEFAULTS.outlineColor),
  };
}
