import { getRouteApi, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Clapperboard,
  Download,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { startTransition, useCallback, useEffect, useState } from "react";
import {
  addScene,
  apiUrl,
  approvePlan,
  assertFfmpegReady,
  ffmpegBlockFromError,
  getReel,
  listReelSeries,
  mediaUrl,
  regenerateReel,
  resumeFailedReel,
  type FfmpegCapability,
  type Reel,
} from "@/api/reels";
import { CaptionSmokeButton } from "@/components/reels/CaptionSmokeDialog";
import { FfmpegBlockModal } from "@/components/reels/FfmpegBlockModal";
import { ReelStatusChip } from "@/components/reels/ReelStatusChip";
import { VoiceVariantsPanel } from "@/components/reels/VoiceVariantsPanel";
import { ConfirmModal } from "@/components/studio/ConfirmModal";
import { EditDraftBanner } from "@/components/studio/EditDraftBanner";
import { GateBanner } from "@/components/studio/GateBanner";
import { InspectorPanel } from "@/components/studio/InspectorPanel";
import { ProgramMonitor } from "@/components/studio/ProgramMonitor";
import { ProjectPanel } from "@/components/studio/ProjectPanel";
import { TimelinePanel } from "@/components/studio/TimelinePanel";
import { SceneCard } from "@/components/studio/panels/SceneCard";
import type { ConfirmAction, InspectorTab, StudioRun } from "@/components/studio/types";
import { Button, buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  gameplayRerenderCostsCredits,
  isAssetStreamingStatus,
  REEL_ACTIVE_STATUSES,
  REEL_ASSET_POLL_MS,
  REEL_SETTLE_MS,
  reelNeedsPolling,
  reelProgressLabel,
  reelStudioLocked,
} from "@/utils/reel";

const route = getRouteApi("/studio/$id");

export function StudioScreen() {
  const { id } = route.useParams();
  const [reel, setReel] = useState<Reel | undefined>();
  const [seriesReels, setSeriesReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    ConfirmAction | undefined
  >();
  const [ffmpegBlock, setFfmpegBlock] = useState<FfmpegCapability | undefined>();
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("source");
  /** Temporary program-monitor override for a ready voice variant (before promote). */
  const [variantPreviewUrl, setVariantPreviewUrl] = useState<string | undefined>();

  const selectScene = useCallback((index: number) => {
    startTransition(() => setSelectedSceneIndex(index));
  }, []);

  const changeInspectorTab = useCallback((tab: InspectorTab) => {
    startTransition(() => setInspectorTab(tab));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await getReel(id);
      setReel(next);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reel");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setVariantPreviewUrl(undefined);
  }, [id]);

  useEffect(() => {
    if (!reel?.seriesId) {
      setSeriesReels([]);
      return;
    }
    let cancelled = false;
    void listReelSeries(reel.seriesId)
      .then((parts) => {
        if (!cancelled) setSeriesReels(parts);
      })
      .catch(() => {
        if (!cancelled) setSeriesReels([reel]);
      });
    return () => {
      cancelled = true;
    };
  }, [reel]);

  const needsPoll = reelNeedsPolling(reel);
  const assetStreaming = isAssetStreamingStatus(reel?.status);
  const pollMs = assetStreaming ? REEL_ASSET_POLL_MS : 2500;

  // Poll while produce / revoice / YouTube publish (or any other in-flight job) may
  // still mutate the reel. Publish + revoice leave status=completed, so status-only
  // polling never picks them up. Depend on the boolean, not `reel`, so each refresh
  // doesn't tear down and restart the interval. When polling stops, one trailing
  // refresh catches auto-publish flipping youtube→pending right after completed.
  useEffect(() => {
    if (needsPoll) {
      void refresh();
      const t = setInterval(() => void refresh(), pollMs);
      return () => clearInterval(t);
    }
    const settle = setTimeout(() => void refresh(), REEL_SETTLE_MS);
    return () => clearTimeout(settle);
  }, [needsPoll, refresh, pollMs]);

  useEffect(() => {
    if (!reel?.editDraft) return;
    const reelKey = reel._id ?? reel.id ?? "";
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onPageHide = () => {
      if (!reelKey) return;
      const url = apiUrl(
        `/reels/${encodeURIComponent(reelKey)}/edit-draft/discard`,
      );
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url);
        return;
      }
      void fetch(url, { method: "POST", keepalive: true });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [reel?._id, reel?.id, reel?.editDraft]);

  // Run an edit action, reflect the returned reel, surface errors.
  // Paid generate/regenerate paths preflight FFmpeg so users get a modal before spend.
  const run = useCallback<StudioRun>(async (action, opts) => {
    setBusy(true);
    setError(undefined);
    try {
      if (opts?.requireFfmpeg) await assertFfmpegReady();
      setReel(await action());
    } catch (err) {
      const block = ffmpegBlockFromError(err);
      if (block) setFfmpegBlock(block);
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const count = reel?.scenes?.length ?? 0;
    if (count === 0) return;
    setSelectedSceneIndex((index) => Math.min(Math.max(index, 0), count - 1));
  }, [reel?.scenes?.length]);

  if (loading) {
    return (
      <section className="grid place-items-center py-20 text-muted-foreground">
        <Loader2 className="animate-spin" size={26} />
      </section>
    );
  }

  if (!reel) {
    return (
      <section className="px-4 py-6">
        <p className="text-sm text-destructive">{error ?? "Reel not found."}</p>
        <Link
          to="/"
          search={{ status: undefined }}
          className="text-sm text-primary"
        >
          ← Back to reels
        </Link>
      </section>
    );
  }

  const isGenerating = REEL_ACTIVE_STATUSES.includes(reel.status);
  /** Block edits while produce / revoice / publish is in flight (or local busy). */
  const studioLocked = busy || reelStudioLocked(reel);
  const isGameplay = reel.strategy === "gameplay_overlay";
  const scenes = reel.scenes ?? [];
  const hasDraft = Boolean(reel.editDraft);
  // A look/voice change (art, image model, narration voice, voice FX) clears the
  // affected assets so the next produce regenerates them — deferred by design, so
  // it's easy to miss. Surface it on an already-produced reel with a one-click apply.
  // Image reels: missing still/audio means look/voice cleared assets.
  // Gameplay: sentence audioUrls are cached after the first successful produce —
  // missing ones mean TTS will run for those segments on the next render.
  const clearedImages =
    !isGameplay && scenes.some((s) => !s.assetUrl && !s.isHero);
  const clearedAudio = isGameplay
    ? gameplayRerenderCostsCredits(reel)
    : scenes.some((s) => !s.audioUrl);
  const pendingRegen =
    !isGameplay &&
    !isGenerating &&
    !hasDraft &&
    Boolean(reel.outputUrl) &&
    scenes.length > 0 &&
    (clearedImages || clearedAudio);
  const basePreviewUrl =
    variantPreviewUrl ?? mediaUrl(reel.editDraft?.outputUrl) ?? reel.outputUrl;
  const previewUrl = basePreviewUrl
    ? `${basePreviewUrl}${basePreviewUrl.includes("?") ? "&" : "?"}v=${encodeURIComponent(
        variantPreviewUrl
          ? `variant-${variantPreviewUrl}`
          : (reel.outputUrl ?? reel.editDraft?.id ?? reel.updatedAt ?? String(reel.progress)),
      )}`
    : undefined;
  const selectedScene = scenes[selectedSceneIndex] ?? scenes[0];

  return (
    <section className="studio-workspace w-full min-w-0 overflow-x-clip text-foreground">
      <header className="sticky top-0 z-20 flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to="/"
            search={{ status: undefined }}
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Back to reels"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <h1 className="m-0 min-w-0 truncate text-sm font-semibold tracking-normal text-foreground">
              {reel.title || "Untitled reel"}
            </h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {reel.niche} · {reel.genre ?? "no genre"} ·{" "}
              <ReelStatusChip status={reel.status} size="sm" /> · {reel.progress}%
              {reel.currentStep ? ` · ${reel.currentStep}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {hasDraft ? (
            <span className="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
              Unsaved draft
            </span>
          ) : null}
          <Link
            to="/studio/$id/thumbnail"
            params={{ id }}
            search={{ mode: "shorts" }}
            className={cn(buttonClassName("outline"), "no-underline")}
            title="Open Shorts Cover Studio"
          >
            <Clapperboard size={14} />
            <span className="hidden sm:inline">Shorts cover</span>
          </Link>
          <Link
            to="/studio/$id/thumbnail"
            params={{ id }}
            search={{ mode: undefined }}
            className={cn(buttonClassName("outline"), "no-underline")}
            title="Open Thumbnail Studio"
          >
            <ImageIcon size={14} />
            <span className="hidden sm:inline">Thumbnail</span>
          </Link>
          {reel.outputUrl ? (
            <a
              href={apiUrl(`/reels/${encodeURIComponent(id)}/download`)}
              download
              target="_blank"
              rel="noreferrer"
              className={cn(buttonClassName("outline"), "no-underline")}
              title="Download the rendered video"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Download</span>
            </a>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Refresh"
            onClick={() => void refresh()}
            disabled={studioLocked}
          >
            <RefreshCw
              size={15}
              className={isGenerating || studioLocked ? "animate-spin" : undefined}
            />
          </Button>
        </div>
      </header>

      <div className="px-3 pb-6 pt-3 sm:px-4 lg:px-5">
      {error ? (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {studioLocked && !busy ? (
        <div className="mb-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          {isGenerating
            ? `Job in progress (${reelProgressLabel(reel)}) — edits and re-renders are locked. Scene stills and narration appear as each one finishes.`
            : reel.voiceVariants?.some((v) => v.status === "pending")
              ? "Revoice in progress — edits and re-renders are locked."
              : "YouTube publish in progress — edits and re-renders are locked."}
        </div>
      ) : null}

      <EditDraftBanner reel={reel} busy={studioLocked} run={run} />

      {reel.status === "failed" ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <div className="min-w-0">
            <div className="font-semibold">
              {/caption burn|ffmpeg/i.test(reel.error ?? "")
                ? "Caption burn / FFmpeg failed"
                : "Produce failed"}
            </div>
            <div className="text-xs text-destructive/80">
              {reel.error?.trim() || reel.captionBurnError?.trim() || "Unknown error."}{" "}
              {reel.scenes?.some((s) => s.assetUrl || s.audioUrl)
                ? "Scene images and narration already on S3 are kept — resume re-runs render only (no new AI spend)."
                : "No scene assets were saved yet — resume will regenerate from the start."}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {/caption burn|ffmpeg/i.test(reel.error ?? "") || reel.captionBurnError ? (
              <CaptionSmokeButton size="sm" variant="outline" label="Test captions" />
            ) : null}
            <Button
              type="button"
              disabled={studioLocked}
              onClick={() =>
                setConfirmAction({
                  title: "Resume failed job?",
                  body: isGameplay
                    ? gameplayRerenderCostsCredits(reel)
                      ? "Re-runs TTS for uncached segments + gameplay composite."
                      : "Reuses cached narration, then re-composites over gameplay."
                    : "Reuses scene images and narration already on S3, then re-renders.",
                  details: isGameplay
                    ? gameplayRerenderCostsCredits(reel)
                      ? [
                          "OpenRouter narration credits will be charged for missing segments.",
                          "After this run, later re-renders reuse cached audio.",
                        ]
                      : ["Narration audio is already cached — no OpenRouter TTS."]
                    : ["No new image/TTS spend if assets are already on S3."],
                  confirmLabel: "Resume",
                  onConfirm: () => run(() => resumeFailedReel(id), { requireFfmpeg: true }),
                })
              }
            >
              {busy ? (
                <Loader2 className="animate-spin" size={15} />
              ) : (
                <RefreshCw size={15} />
              )}
              Resume (reuse assets)
            </Button>
          </div>
        </div>
      ) : null}

      <GateBanner
        reel={reel}
        busy={studioLocked}
        run={run}
        requestConfirm={setConfirmAction}
        onApprove={() =>
          setConfirmAction({
            title:
              reel.partCount && reel.partCount > 1
                ? `Generate part ${reel.partNumber ?? 1}?`
                : "Generate reel?",
            body: "This starts the paid produce run for the reviewed plan.",
            details: [
              "Generates missing scene images with OpenRouter.",
              "Generates missing narration audio with OpenRouter TTS.",
              reel.skipPartOutro
                ? "Part teaser skipped."
                : reel.strategy === "gameplay_overlay" &&
                    (reel.partNumber ?? reel.redditStory?.partNumber ?? 1) <
                      (reel.partCount ?? reel.redditStory?.partCount ?? 1)
                  ? "Includes part teaser (“Stay tuned…”)."
                  : "",
              reel.skipBrandedOutro
                ? "Branded outro skipped."
                : "Includes branded outro (channel card + subscribe TTS).",
              "Renders captions, horror mix, edit FX, and preview video after assets are ready.",
              "Spend is recorded on this reel's cost breakdown when the job finishes.",
            ].filter(Boolean),
            confirmLabel: "Generate",
            onConfirm: () => run(() => approvePlan(id), { requireFfmpeg: true }),
          })
        }
      />

      {pendingRegen ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm text-warning">
          <div className="min-w-0">
            <div className="font-semibold text-warning">
              Settings changed — re-render to apply
            </div>
            <div className="text-xs text-warning/80">
              {clearedImages && clearedAudio
                ? "Scene stills and narration were cleared"
                : clearedImages
                  ? "Scene stills were cleared"
                  : "Narration was cleared"}{" "}
              by a look/voice change. Re-render to regenerate{" "}
              {clearedImages && clearedAudio
                ? "them"
                : clearedImages
                  ? "the stills"
                  : "the narration"}{" "}
              and bake the change into the video.
            </div>
          </div>
          <Button
            type="button"
            disabled={studioLocked}
            onClick={() =>
              setConfirmAction({
                title: "Re-render to apply look/voice changes?",
                body: "This regenerates cleared assets with OpenRouter, then re-renders the preview.",
                details: [
                  clearedImages ? "Scene stills will be regenerated (image credits)." : "",
                  clearedAudio ? "Narration will be regenerated (TTS credits)." : "",
                  "Spend is added to this reel's cost breakdown when the job finishes.",
                ].filter(Boolean),
                confirmLabel: "Re-render",
                onConfirm: () => run(() => regenerateReel(id, "render_only"), { requireFfmpeg: true }),
              })
            }
            className="shrink-0"
          >
            {busy ? (
              <Loader2 className="animate-spin" size={15} />
            ) : (
              <RefreshCw size={15} />
            )}
            Re-render to apply
          </Button>
        </div>
      ) : null}

      <div className="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(240px,280px)_minmax(0,1fr)_minmax(320px,380px)]">
        <aside className="grid min-h-0 min-w-0 gap-3 xl:sticky xl:top-[61px] xl:max-h-[calc(100vh-73px)]">
          <ProjectPanel
            reel={reel}
            seriesReels={seriesReels}
            currentId={id}
            scenes={scenes}
            selectedSceneIndex={selectedSceneIndex}
            onSelectScene={selectScene}
          />
        </aside>

        <main className="grid min-w-0 content-start gap-3">
          <ProgramMonitor
            reel={reel}
            previewUrl={previewUrl}
            variantPreview={Boolean(variantPreviewUrl)}
            onClearVariantPreview={() => setVariantPreviewUrl(undefined)}
          />
          <TimelinePanel
            reelId={id}
            reel={reel}
            scenes={scenes}
            selectedSceneIndex={selectedSceneIndex}
            onSelectScene={selectScene}
            busy={studioLocked}
            disabled={studioLocked}
            run={run}
            onAddScene={() =>
              void run(() =>
                addScene(id, { narration: "New scene narration." }),
              )
            }
          />
          {selectedScene ? (
            <SceneCard
              reelId={id}
              reel={reel}
              scene={selectedScene}
              total={scenes.length}
              busy={studioLocked}
              disabled={studioLocked}
              isGameplay={isGameplay}
              run={run}
              requestConfirm={setConfirmAction}
            />
          ) : (
            <div className="grid place-items-center rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
              No scenes yet.
            </div>
          )}
        </main>

        <div className="grid min-h-0 min-w-0 gap-3 xl:sticky xl:top-[61px] xl:max-h-[calc(100vh-73px)] xl:overflow-y-auto xl:pr-1">
          <InspectorPanel
            tab={inspectorTab}
            onTabChange={changeInspectorTab}
            reel={reel}
            busy={studioLocked}
            isGameplay={isGameplay}
            run={run}
            requestConfirm={setConfirmAction}
          />
          <VoiceVariantsPanel
            reel={reel}
            reelId={id}
            locked={studioLocked}
            onRefresh={refresh}
            onPreviewVariant={setVariantPreviewUrl}
            requestConfirm={setConfirmAction}
          />
        </div>
      </div>
      </div>
      <ConfirmModal
        action={confirmAction}
        busy={busy}
        onClose={() => setConfirmAction(undefined)}
      />
      <FfmpegBlockModal
        capability={ffmpegBlock}
        onClose={() => setFfmpegBlock(undefined)}
      />
    </section>
  );
}
