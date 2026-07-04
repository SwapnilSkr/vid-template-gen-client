import type { YtImportCaptionCue } from "@/api/yt-imports";

/** Find the caption cue active at `atSec` — O(n) scan; fine for typical VTT sizes. */
export function findCaptionAt(
  captions: YtImportCaptionCue[] | undefined,
  atSec: number
): YtImportCaptionCue | null {
  if (!captions?.length) return null;
  return captions.find((cue) => atSec >= cue.startSec && atSec <= cue.endSec) ?? null;
}
