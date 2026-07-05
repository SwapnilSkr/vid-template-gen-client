import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowLeft, Film, Loader2, Play, Trash2, Volume2 } from "lucide-react";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import {
  audioClipUrl,
  deleteYtImport,
  extractFrames,
  frameUrlForImport,
  resolveMediaUrl,
} from "@/api/yt-imports";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader, PanelTitle, panelClassName } from "@/components/ui/panel";
import {
  FrameRangeControls,
  parseFrameRange,
  type FrameRangeValues,
} from "@/components/youtube/FrameRangeControls";
import { FrameGrid } from "@/components/youtube/FrameGrid";
import { formatTime } from "@/components/youtube/format";
import { useThrottledCallback } from "@/hooks/use-throttled-callback";
import { useYtImportPoll } from "@/hooks/use-yt-import-poll";
import { findCaptionAt } from "@/utils/captions";
import { importHasVisibleFrames } from "@/utils/yt-import";
import { cn } from "@/lib/utils";

const route = getRouteApi("/youtube/$importId");

const IN_PROGRESS_STATUSES = new Set(["pending", "downloading", "uploading"]);

function frameRangeFromItem(item: {
  frameRangeStartSec?: number;
  frameRangeEndSec?: number;
}): FrameRangeValues {
  return {
    startSec: String(item.frameRangeStartSec ?? 0),
    endSec: item.frameRangeEndSec != null ? String(item.frameRangeEndSec) : "",
  };
}

export function YtImportDetailScreen() {
  const { importId } = route.useParams();
  const initialData = route.useLoaderData();
  const { item, loading, error, refresh, beginBurstPolling, patchItem, setError } =
    useYtImportPoll(importId, initialData);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playheadRef = useRef(0);

  const [displayTime, setDisplayTime] = useState(0);
  const [selectedFrame, setSelectedFrame] = useState<number | undefined>();
  const [frameRange, setFrameRange] = useState<FrameRangeValues>(() =>
    frameRangeFromItem(initialData)
  );
  const [extractPending, startExtractTransition] = useTransition();

  const handleTimeUpdate = useThrottledCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const time = event.currentTarget.currentTime;
    playheadRef.current = time;
    setSelectedFrame(undefined);
    setDisplayTime(time);
  }, 250);

  const activeTime = useMemo(() => {
    if (selectedFrame != null && item?.fps) return selectedFrame / item.fps;
    return displayTime;
  }, [selectedFrame, item?.fps, displayTime]);

  const caption = useMemo(
    () => findCaptionAt(item?.captions, activeTime),
    [item?.captions, activeTime]
  );

  const handleExtractFrames = useCallback(() => {
    if (!item) return;
    startExtractTransition(async () => {
      setError(undefined);
      try {
        const range = parseFrameRange(frameRange, item.durationSec);
        patchItem({
          status: "extracting_frames",
          progress: 75,
          framesExtracted: false,
          frameIndices: [],
          frameCount: 0,
        });
        beginBurstPolling();
        await extractFrames(item._id, range);
        setFrameRange(frameRangeFromItem({ ...item, ...range }));
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Frame extraction failed");
        await refresh();
      }
    });
  }, [item, frameRange, refresh, beginBurstPolling, patchItem, setError]);

  const handleDelete = useCallback(async () => {
    if (!item || !confirm("Delete this import and all its assets?")) return;
    try {
      await deleteYtImport(item._id);
      window.location.href = "/youtube";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }, [item, setError]);

  const handleSelectFrame = useCallback(
    (frameIndex: number) => {
      if (!item?.fps) return;
      const atSec = frameIndex / item.fps;
      setSelectedFrame(frameIndex);
      playheadRef.current = atSec;
      setDisplayTime(atSec);
      if (videoRef.current) videoRef.current.currentTime = atSec;
    },
    [item?.fps]
  );

  const playAudioAtTime = useCallback(
    async (atSec: number) => {
      if (!item || !audioRef.current) return;
      audioRef.current.src = audioClipUrl(item._id, atSec, 3);
      await audioRef.current.play().catch(() => {});
    },
    [item]
  );

  if (loading && !item) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-6 text-center text-destructive">{error ?? "Import not found"}</div>
    );
  }

  const videoSrc = resolveMediaUrl(item.videoUrl);
  const inProgress = IN_PROGRESS_STATUSES.has(item.status);
  const processingFrames = item.status === "extracting_frames";
  const framesBusy = extractPending || processingFrames;
  const frames = item.frameIndices ?? [];
  const hasFrames = importHasVisibleFrames(item);
  const canViewVideo = Boolean(videoSrc) && item.status !== "failed" && item.status !== "pending";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/youtube"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground no-underline hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to search
        </Link>
        <Button variant="destructive" onClick={() => void handleDelete()}>
          <Trash2 size={16} />
          Delete assets
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <header className="rounded-lg border border-border bg-card/70 px-4 py-3 shadow-[var(--shadow-panel)]">
        <h1 className="text-xl font-extrabold text-foreground">{item.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {item.channelTitle} · {item.assetId} · {item.storage.toUpperCase()}
        </p>
      </header>

      {inProgress || processingFrames ? (
        <Panel>
          <PanelHeader>
            <PanelTitle>{processingFrames ? "Extracting frames" : "Processing"}</PanelTitle>
          </PanelHeader>
          <div className="p-4">
            <div className="mb-2 flex items-center gap-2 text-sm">
              <Loader2 className="animate-spin" size={16} />
              {item.status.replace(/_/g, " ")} — {item.progress}%
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${item.progress}%` }}
              />
            </div>
            {item.error ? <p className="mt-2 text-sm text-destructive">{item.error}</p> : null}
          </div>
        </Panel>
      ) : null}

      {canViewVideo && videoSrc ? (
        <>
          <Panel>
            <PanelHeader>
              <PanelTitle>Video</PanelTitle>
              <span className="text-xs text-muted-foreground">{formatTime(displayTime)}</span>
            </PanelHeader>
            <div className="p-3.5">
              <video
                ref={videoRef}
                src={videoSrc}
                controls
                className="max-h-[480px] w-full rounded-md bg-black"
                onTimeUpdate={handleTimeUpdate}
              />
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <PanelHeader>
                <PanelTitle>Caption at playhead</PanelTitle>
                <Button
                  variant="ghost"
                  className="min-h-8"
                  onClick={() => void playAudioAtTime(activeTime)}
                >
                  <Volume2 size={16} />
                  Play 3s audio
                </Button>
              </PanelHeader>
              <div className="min-h-[100px] p-4 text-sm leading-relaxed text-foreground">
                {caption?.text ? (
                  caption.text
                ) : (
                  <span className="text-muted-foreground">No caption at this timestamp.</span>
                )}
              </div>
              <audio ref={audioRef} className="hidden" />
            </Panel>

            <Panel>
              <PanelHeader>
                <PanelTitle>Frames</PanelTitle>
              </PanelHeader>
              <div className="flex flex-col gap-3 p-3.5">
                {hasFrames ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {item.frameCount.toLocaleString()} frames
                      {item.fps ? ` @ ${item.fps.toFixed(2)} fps` : ""}
                      {item.frameRangeStartSec != null && item.frameRangeEndSec != null
                        ? ` · ${item.frameRangeStartSec}s–${item.frameRangeEndSec}s`
                        : ""}
                      {item.frameIndicesTotal && item.frameIndicesTotal > frames.length
                        ? ` — showing first ${frames.length}`
                        : ""}
                    </p>
                    <FrameGrid
                      item={item}
                      frames={frames}
                      selectedFrame={selectedFrame}
                      onSelectFrame={handleSelectFrame}
                    />
                    <details className="rounded-md border border-border/60 p-3">
                      <summary className="cursor-pointer text-sm font-bold">
                        Re-extract different range
                      </summary>
                      <div className="mt-3 flex flex-col gap-3">
                        <FrameRangeControls
                          values={frameRange}
                          onChange={setFrameRange}
                          durationSec={item.durationSec}
                          playheadSec={displayTime}
                          disabled={framesBusy}
                        />
                        <Button
                          variant="outline"
                          disabled={framesBusy}
                          onClick={handleExtractFrames}
                        >
                          {framesBusy ? (
                            <Loader2 className="animate-spin" size={16} />
                          ) : (
                            <Film size={16} />
                          )}
                          Replace frames
                        </Button>
                      </div>
                    </details>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Scrub the video to inspect captions, then choose a time range and extract
                      frames. You can do this anytime after the video finishes downloading.
                    </p>
                    <FrameRangeControls
                      values={frameRange}
                      onChange={setFrameRange}
                      durationSec={item.durationSec}
                      playheadSec={displayTime}
                      disabled={framesBusy}
                    />
                    <Button variant="default" disabled={framesBusy} onClick={handleExtractFrames}>
                      {framesBusy ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <Film size={16} />
                      )}
                      Extract frames
                    </Button>
                  </>
                )}
              </div>
            </Panel>
          </div>

          {selectedFrame != null && item.fps ? (
            <Panel>
              <PanelHeader>
                <PanelTitle>
                  Frame {selectedFrame} · {formatTime(selectedFrame / item.fps)}
                </PanelTitle>
                <Button
                  variant="ghost"
                  className="min-h-8"
                  onClick={() => void playAudioAtTime(selectedFrame / item.fps!)}
                >
                  <Play size={16} />
                  Play audio
                </Button>
              </PanelHeader>
              <div className="flex flex-col gap-3 p-3.5 sm:flex-row">
                <img
                  src={frameUrlForImport(item, selectedFrame)}
                  alt={`Selected frame ${selectedFrame}`}
                  className="max-h-64 rounded-md border border-border object-contain"
                  loading="lazy"
                  decoding="async"
                />
                <div className="flex-1 text-sm leading-relaxed">
                  {caption?.text ?? "No caption for this frame."}
                </div>
              </div>
            </Panel>
          ) : null}
        </>
      ) : null}

      {item.status === "failed" ? (
        <div className={cn(panelClassName, "p-4 text-sm text-destructive")}>
          Download failed: {item.error ?? "Unknown error"}
        </div>
      ) : null}
    </div>
  );
}
