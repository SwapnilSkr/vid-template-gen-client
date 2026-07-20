import { getRouteApi, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  AtSign,
  CheckCircle2,
  Clapperboard,
  CircleAlert,
  Download,
  Facebook,
  Image as ImageIcon,
  Instagram,
  Clock3,
  Loader2,
  RefreshCw,
  Scissors,
  X,
  Youtube,
} from "lucide-react";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import {
  addScene,
  apiUrl,
  approvePlan,
  assertFfmpegReady,
  deleteSeriesPart,
  chooseSeriesStructure,
  ffmpegBlockFromError,
  getReel,
  getSeriesStructureAdvice,
  getThumbnailSource,
  listReelSeries,
  mergePartIntoPrevious,
  moveSeriesBoundary,
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
import { FinalVideoTrimDialog } from "@/components/studio/FinalVideoTrimDialog";
import { GateBanner } from "@/components/studio/GateBanner";
import { InspectorPanel } from "@/components/studio/InspectorPanel";
import { ProgramMonitor } from "@/components/studio/ProgramMonitor";
import { ProjectPanel } from "@/components/studio/ProjectPanel";
import { TimelinePanel } from "@/components/studio/TimelinePanel";
import { SceneCard } from "@/components/studio/panels/SceneCard";
import type { ConfirmAction, InspectorTab, StudioPublishTarget, StudioRun } from "@/components/studio/types";
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

type PublishPlatform = StudioPublishTarget["platform"];
type PublishState = "pending" | "uploading" | "published" | "failed";

interface PublishDestinationState extends StudioPublishTarget {
  status: PublishState;
  url?: string;
  error?: string;
  message?: string;
  updatedAt?: string;
}

interface PublishSnapshot {
  status: PublishState;
  fingerprint: string;
}

interface PublishToast {
  id: string;
  platform: PublishPlatform;
  channelLabel: string;
  state: "queued" | "published" | "failed";
  detail?: string;
  url?: string;
}

function publishDestinationStates(reel: Reel): PublishDestinationState[] {
  const states: PublishDestinationState[] = [];
  if (reel.youtube) {
    states.push({
      platform: "youtube",
      channelId: reel.youtube.channelId ?? "default",
      channelLabel: reel.youtube.channelLabel ?? "YouTube Shorts",
      status: reel.youtube.status,
      url: reel.youtube.url,
      error: reel.youtube.error,
      updatedAt: reel.youtube.publishedAt,
    });
  }
  for (const publish of reel.instagram ?? []) {
    states.push({
      platform: "instagram",
      channelId: publish.channelId,
      channelLabel: publish.channelLabel ?? "Instagram Reel",
      status: publish.status,
      url: publish.url,
      error: publish.error,
      message: publish.message,
      updatedAt: publish.updatedAt ?? publish.publishedAt,
    });
  }
  for (const publish of reel.facebook ?? []) {
    states.push({
      platform: "facebook",
      channelId: publish.channelId,
      channelLabel: publish.channelLabel ?? "Facebook Reel",
      status: publish.status,
      url: publish.url,
      error: publish.error,
      message: publish.message,
      updatedAt: publish.updatedAt ?? publish.publishedAt,
    });
  }
  for (const publish of reel.threads ?? []) {
    states.push({
      platform: "threads",
      channelId: publish.channelId,
      channelLabel: publish.channelLabel ?? "Threads",
      status: publish.status,
      url: publish.url,
      error: publish.error,
      message: publish.message,
      updatedAt: publish.updatedAt ?? publish.publishedAt,
    });
  }
  return states;
}

function publishTargetKey(target: Pick<StudioPublishTarget, "platform" | "channelId">) {
  return `${target.platform}:${target.channelId}`;
}

function publishSnapshot(state: PublishDestinationState): PublishSnapshot {
  return {
    status: state.status,
    fingerprint: [
      state.status,
      state.updatedAt ?? "",
      state.url ?? "",
      state.error ?? "",
      state.message ?? "",
    ].join("\u0001"),
  };
}

function PublishToastStack({
  toasts,
  onDismiss,
}: {
  toasts: PublishToast[];
  onDismiss: (id: string) => void;
}) {
  if (!toasts.length) return null;
  const labels: Record<PublishPlatform, string> = {
    youtube: "YouTube Shorts",
    instagram: "Instagram",
    facebook: "Facebook",
    threads: "Threads",
  };
  const icons: Record<PublishPlatform, typeof Youtube> = {
    youtube: Youtube,
    instagram: Instagram,
    facebook: Facebook,
    threads: AtSign,
  };
  return (
    <aside
      aria-live="polite"
      aria-label="Publishing updates"
      className="fixed right-3 top-16 z-[80] grid w-[min(24rem,calc(100vw-1.5rem))] gap-2 sm:right-5"
    >
      {toasts.map((toast) => {
        const PlatformIcon = icons[toast.platform];
        const isFailure = toast.state === "failed";
        const isQueued = toast.state === "queued";
        const StateIcon = isFailure ? CircleAlert : isQueued ? Clock3 : CheckCircle2;
        const stateLabel = isFailure ? "Publish failed" : isQueued ? "Publish queued" : "Published";
        return (
          <div
            key={toast.id}
            role={isFailure ? "alert" : "status"}
            className={cn(
              "grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2 rounded-lg border bg-card px-3 py-2.5 shadow-lg backdrop-blur",
              isFailure
                ? "border-destructive/45"
                : isQueued
                  ? "border-primary/45"
                  : "border-success/45",
            )}
          >
            <span className={cn("mt-0.5 grid size-7 place-items-center rounded-full", isFailure ? "bg-destructive/12 text-destructive" : isQueued ? "bg-primary/12 text-primary" : "bg-success/12 text-success")}>
              <PlatformIcon size={14} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <StateIcon size={13} className={isFailure ? "text-destructive" : isQueued ? "text-primary" : "text-success"} />
                {labels[toast.platform]} · {stateLabel}
              </div>
              <p className="m-0 mt-0.5 truncate text-xs text-muted-foreground" title={toast.channelLabel}>
                {toast.channelLabel}
              </p>
              {toast.detail ? <p className={cn("m-0 mt-1 text-[11px] leading-snug", isFailure ? "text-destructive" : "text-muted-foreground")}>{toast.detail}</p> : null}
              {toast.url ? <a href={toast.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] font-medium text-primary hover:underline">Open post →</a> : null}
            </div>
            <button type="button" onClick={() => onDismiss(toast.id)} className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Dismiss publishing update">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </aside>
  );
}

export function StudioScreen() {
  const { id } = route.useParams();
  const navigate = route.useNavigate();
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
  const [openingCoverPreviewUrl, setOpeningCoverPreviewUrl] = useState<string | undefined>();
  const [publishToasts, setPublishToasts] = useState<PublishToast[]>([]);
  const [finalVideoTrimOpen, setFinalVideoTrimOpen] = useState(false);
  const [publishNotificationRevision, setPublishNotificationRevision] = useState(0);
  // A slow poll response must never replace a more recent local edit response.
  const refreshVersionRef = useRef(0);
  const publishSnapshotsRef = useRef<Map<string, PublishSnapshot>>(new Map());
  const publishTrackingReadyRef = useRef(false);
  const requestedPublishTargetsRef = useRef<Map<string, StudioPublishTarget>>(new Map());
  const publishToastTimersRef = useRef<Map<string, number>>(new Map());
  const publishToastSequenceRef = useRef(0);

  const dismissPublishToast = useCallback((toastId: string) => {
    const timer = publishToastTimersRef.current.get(toastId);
    if (timer) window.clearTimeout(timer);
    publishToastTimersRef.current.delete(toastId);
    setPublishToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const addPublishToast = useCallback((toast: Omit<PublishToast, "id">) => {
    const toastId = `publish-${Date.now()}-${++publishToastSequenceRef.current}`;
    setPublishToasts((current) => [...current.slice(-4), { ...toast, id: toastId }]);
    const duration = toast.state === "failed" ? 11_000 : toast.state === "queued" ? 5_500 : 8_000;
    const timer = window.setTimeout(() => dismissPublishToast(toastId), duration);
    publishToastTimersRef.current.set(toastId, timer);
  }, [dismissPublishToast]);

  useEffect(() => () => {
    for (const timer of publishToastTimersRef.current.values()) window.clearTimeout(timer);
    publishToastTimersRef.current.clear();
  }, []);

  const selectScene = useCallback((index: number) => {
    startTransition(() => setSelectedSceneIndex(index));
  }, []);

  const changeInspectorTab = useCallback((tab: InspectorTab) => {
    startTransition(() => setInspectorTab(tab));
  }, []);

  const refresh = useCallback(async () => {
    const version = ++refreshVersionRef.current;
    try {
      const next = await getReel(id);
      if (version !== refreshVersionRef.current) return;
      setReel(next);
      setError(undefined);
    } catch (err) {
      if (version !== refreshVersionRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load reel");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Never replay old publishing history when a reel first opens. We only toast
  // for status changes observed in this Studio session, or a destination the
  // creator just selected in the final publish dialog.
  useEffect(() => {
    publishSnapshotsRef.current.clear();
    requestedPublishTargetsRef.current.clear();
    publishTrackingReadyRef.current = false;
  }, [id]);

  useEffect(() => {
    if (!reel) return;
    const states = publishDestinationStates(reel);
    const nextSnapshots = new Map<string, PublishSnapshot>();
    for (const state of states) {
      nextSnapshots.set(publishTargetKey(state), publishSnapshot(state));
    }
    if (!publishTrackingReadyRef.current) {
      publishSnapshotsRef.current = nextSnapshots;
      publishTrackingReadyRef.current = true;
      return;
    }

    for (const state of states) {
      const key = publishTargetKey(state);
      const previous = publishSnapshotsRef.current.get(key);
      const current = nextSnapshots.get(key)!;
      const selectedInThisSession = requestedPublishTargetsRef.current.has(key);
      const wasActive = previous?.status === "pending" || previous?.status === "uploading";
      const isActive = state.status === "pending" || state.status === "uploading";
      const changed = previous?.fingerprint !== current.fingerprint;

      if (isActive && !wasActive) {
        addPublishToast({
          platform: state.platform,
          channelLabel: state.channelLabel,
          state: "queued",
          detail: state.message ?? "Upload is being prepared in the background.",
        });
      }

      if (state.status === "published" && (selectedInThisSession || !previous || previous.status !== "published" || changed)) {
        addPublishToast({
          platform: state.platform,
          channelLabel: state.channelLabel,
          state: "published",
          detail: state.message ?? "Your post is live.",
          url: state.url,
        });
        requestedPublishTargetsRef.current.delete(key);
      }

      if (state.status === "failed" && (selectedInThisSession || !previous || previous.status !== "failed" || changed)) {
        addPublishToast({
          platform: state.platform,
          channelLabel: state.channelLabel,
          state: "failed",
          detail: state.error ?? state.message ?? "The platform did not accept this post.",
        });
        requestedPublishTargetsRef.current.delete(key);
      }
    }
    publishSnapshotsRef.current = nextSnapshots;
  }, [addPublishToast, publishNotificationRevision, reel]);

  const trackPublishTargets = useCallback((targets: StudioPublishTarget[]) => {
    for (const target of targets) {
      requestedPublishTargetsRef.current.set(publishTargetKey(target), target);
    }
    // The publish endpoint can finish synchronously. Force an immediate
    // reconciliation after selection so that case still gets a success toast.
    setPublishNotificationRevision((revision) => revision + 1);
  }, []);

  useEffect(() => {
    setVariantPreviewUrl(undefined);
  }, [id]);

  // Before a Reddit MP4 exists, show the same first-frame composition that
  // will be rendered: chosen gameplay, Reddit card, and transparent cover.
  useEffect(() => {
    const reelId = reel?._id ?? reel?.id;
    const needsFallback = Boolean(
      reelId &&
      reel?.niche === "reddit" &&
      reel.strategy === "gameplay_overlay" &&
      reel.gameplayKey &&
      reel.shortsCover?.imageUrl &&
      !reel.outputUrl &&
      !reel.editDraft?.outputUrl &&
      !variantPreviewUrl
    );
    if (!needsFallback || !reelId) {
      setOpeningCoverPreviewUrl(undefined);
      return;
    }
    let cancelled = false;
    void getThumbnailSource(reelId, {
      sourceType: "frame",
      atSeconds: 0,
      aspectRatio: "9:16",
      cleanGameplay: true,
      includeTitleCard: true,
      includeShortsCover: true,
    })
      .then((result) => {
        if (!cancelled) setOpeningCoverPreviewUrl(result.imageDataUrl);
      })
      .catch(() => {
        if (!cancelled) setOpeningCoverPreviewUrl(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [reel?._id, reel?.id, reel?.niche, reel?.strategy, reel?.gameplayKey, reel?.shortsCover?.imageUrl, reel?.outputUrl, reel?.editDraft?.outputUrl, variantPreviewUrl]);

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
      const next = await action();
      // Invalidate any poll that began before this successful mutation.
      refreshVersionRef.current += 1;
      setReel(next);
      const nextId = next._id ?? next.id;
      if (nextId && nextId !== id) {
        void navigate({ to: "/studio/$id", params: { id: nextId }, replace: true });
      }
      return { ok: true };
    } catch (err) {
      const block = ffmpegBlockFromError(err);
      if (block) setFfmpegBlock(block);
      const message = err instanceof Error ? err.message : "Action failed";
      setError(message);
      // Distribution errors may be returned after a worker already changed a
      // target's state. Refresh so retry/republish controls never reason from
      // an old reel snapshot.
      void refresh();
      return { ok: false, error: message };
    } finally {
      setBusy(false);
    }
  }, [id, navigate]);

  // Delete one part of a series. The backend renumbers the survivors; if the
  // deleted part is the one we're viewing, hop to a remaining part (or the reel
  // list when the whole thing is gone), otherwise just refresh in place.
  const deletePart = useCallback(
    async (partId: string) => {
      setBusy(true);
      setError(undefined);
      try {
        const { remainingIds } = await deleteSeriesPart(partId);
        refreshVersionRef.current += 1;
        if (partId === id) {
          const next = remainingIds.find((rid) => rid !== partId);
          if (next) {
            await navigate({ to: "/studio/$id", params: { id: next }, replace: true });
          } else {
            await navigate({ to: "/", search: { status: undefined } });
          }
        } else {
          await refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete part");
      } finally {
        setBusy(false);
      }
    },
    [id, navigate, refresh],
  );

  // Build the confirm dialog for deleting a series part, warning when the change
  // touches parts that are already rendered or published.
  const requestDeletePart = useCallback(
    (part: Reel) => {
      const partId = part._id ?? part.id ?? "";
      if (!partId) return;
      const partLabel = `Part ${part.partNumber ?? 1}`;
      const remaining = seriesReels.filter((p) => (p._id ?? p.id) !== partId);
      const anyRendered = seriesReels.some(
        (p) => p.status === "completed" || Boolean(p.outputUrl),
      );
      const anyPublished = seriesReels.some(
        (p) =>
          p.youtube?.status === "published" ||
          p.youtube?.status === "uploading",
      );
      const details = [
        remaining.length === 1
          ? "Only one part will remain — it becomes a standalone reel with no “stay tuned” teaser."
          : `Remaining parts renumber to Part 1…${remaining.length} of ${remaining.length}.`,
        "This part’s video, audio, and thumbnail are permanently deleted.",
      ];
      if (anyRendered) {
        details.push(
          "Renumbered parts that were already rendered will need re-generating so their teaser matches.",
        );
      }
      if (anyPublished) {
        details.push(
          "A part is already on YouTube — deleting here does NOT unpublish it, and its uploaded “Part N of M” metadata will be out of date.",
        );
      }
      setConfirmAction({
        title: `Delete ${partLabel}?`,
        body: `Remove ${partLabel} from this series and re-record the remaining ${remaining.length} part${remaining.length === 1 ? "" : "s"}.`,
        details,
        confirmLabel: `Delete ${partLabel}`,
        variant: "destructive",
        costTone: "free",
        onConfirm: () => deletePart(partId),
      });
    },
    [seriesReels, deletePart],
  );

  // Nudge the boundary between the current part and the next by one line.
  const moveBoundary = useCallback(
    (direction: "pushLastToNext" | "pullFirstFromNext") =>
      void run(() => moveSeriesBoundary(id, direction)),
    [id, run],
  );

  // Merge the current part into the previous one (confirm — it removes a part).
  const requestMergePart = useCallback(() => {
    const currentNumber = reel?.partNumber ?? 1;
    setConfirmAction({
      title: `Merge Part ${currentNumber} into Part ${currentNumber - 1}?`,
      body: `Append Part ${currentNumber}'s lines onto Part ${currentNumber - 1}, then remove Part ${currentNumber}.`,
      details: [
        "No narration is lost — the lines (and their audio) move into the previous part.",
        `Later parts renumber down by one.`,
      ],
      confirmLabel: "Merge parts",
      costTone: "free",
      onConfirm: () => run(() => mergePartIntoPrevious(id)),
    });
  }, [id, reel?.partNumber, run]);

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
  const openGenerateConfirmation = () => {
    const baseAction = {
      title:
        reel.partCount && reel.partCount > 1
          ? `Generate part ${reel.partNumber ?? 1}?`
          : "Generate reel?",
      body: "This starts paid production for the reviewed plan.",
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
      costTone: "paid" as const,
    };

    if (!isGameplay || !reel.redditStory?.body) {
      setConfirmAction({
        ...baseAction,
        onConfirm: () => run(() => approvePlan(id), { requireFfmpeg: true }),
      });
      return;
    }

    // Ask the server whether Keep/Use-AI is already on file. Local fingerprint
    // checks drift after produce syncs body from scenes and falsely re-blocked Part 2+.
    setBusy(true);
    setError(undefined);
    void getSeriesStructureAdvice(id)
      .then((advice) => {
        if (advice.decisionSatisfied) {
          setConfirmAction({
            ...baseAction,
            onConfirm: () => run(() => approvePlan(id), { requireFfmpeg: true }),
          });
          return;
        }
        setConfirmAction({
          ...baseAction,
          seriesStructure: {
            currentParts: advice.currentParts,
            recommendedParts: advice.recommendedParts,
            wordCount: advice.wordCount,
            estimatedDurationSeconds: advice.estimatedDurationSeconds,
            reason: advice.reason,
            hasWeakBreaks: advice.hasWeakBreaks,
          },
          onConfirm: (choice = "manual") =>
            run(async () => {
              const structured = await chooseSeriesStructure(id, choice);
              const structuredId = structured._id ?? structured.id ?? id;
              // Use AI that changes part count re-queues planning. Approving
              // immediately raced the old 3-part plan and skipped the new split.
              if (structured.status !== "plan_review") {
                return structured;
              }
              return approvePlan(structuredId);
            }, { requireFfmpeg: true }),
        });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load the AI series recommendation.");
      })
      .finally(() => setBusy(false));
  };

  return (
    <>
      <PublishToastStack toasts={publishToasts} onDismiss={dismissPublishToast} />
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
              {reel.status !== "completed" && reel.currentStep ? ` · ${reel.currentStep}` : ""}
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
          {reel.outputUrl ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setFinalVideoTrimOpen(true)}
              disabled={studioLocked}
              title="Remove intervals from the finished primary video"
            >
              <Scissors size={14} />
              <span className="hidden sm:inline">Trim video</span>
            </Button>
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
        <div role="alert" className="sticky top-14 z-30 mb-3 rounded-lg border border-destructive/40 bg-destructive/15 px-3 py-2 text-xs text-destructive shadow-pop" aria-live="assertive">
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
        onApprove={openGenerateConfirmation}
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
            onDeletePart={requestDeletePart}
            onMoveBoundary={moveBoundary}
            onMergePart={requestMergePart}
            partActionsDisabled={studioLocked}
          />
        </aside>

        <main className="grid min-w-0 content-start gap-3">
          <ProgramMonitor
            reel={reel}
            previewUrl={previewUrl}
            fallbackPreviewUrl={openingCoverPreviewUrl}
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
            seriesReels={seriesReels}
            busy={studioLocked}
            isGameplay={isGameplay}
            run={run}
            requestConfirm={setConfirmAction}
            onPublishQueued={trackPublishTargets}
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
      {finalVideoTrimOpen && reel.outputUrl ? (
        <FinalVideoTrimDialog
          reel={reel}
          onClose={() => setFinalVideoTrimOpen(false)}
          onApplied={(updated) => {
            setReel(updated);
            void refresh();
          }}
        />
      ) : null}
    </section>
    </>
  );
}
