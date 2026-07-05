import type { YtImport, YtImportStatus } from "@/api/yt-imports";

const IN_PROGRESS: ReadonlySet<YtImportStatus> = new Set([
  "pending",
  "downloading",
  "uploading",
  "extracting_frames",
]);

/** True when frame thumbnails should render in the UI. */
export function importHasVisibleFrames(item: Pick<
  YtImport,
  "framesExtracted" | "frameCount" | "frameIndices"
>): boolean {
  if ((item.frameIndices?.length ?? 0) > 0) return true;
  if (item.framesExtracted && item.frameCount > 0) return true;
  return false;
}

/** True while the client should keep polling for fresh import state. */
export function importNeedsPolling(item: YtImport | null): boolean {
  if (!item) return true;
  if (item.status === "failed") return false;
  if (IN_PROGRESS.has(item.status)) return true;
  if (item.framesExtracted && item.frameCount > 0 && (item.frameIndices?.length ?? 0) === 0) {
    return true;
  }
  if (item.extractFrames && !item.framesExtracted && item.status === "completed") return true;
  return false;
}

/** True when frame metadata says done but indices haven't arrived yet. */
export function importAwaitingFrameIndices(item: YtImport): boolean {
  return (
    item.framesExtracted &&
    item.frameCount > 0 &&
    (item.frameIndices?.length ?? 0) === 0
  );
}
