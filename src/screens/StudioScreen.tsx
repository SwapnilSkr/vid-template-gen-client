import { getRouteApi, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Captions,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  Loader2,
  Palette,
  Play,
  Receipt,
  RefreshCw,
  Scissors,
  Send,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Wand2,
  Volume2,
  X,
  Youtube,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addScene,
  approvePlan,
  apiUrl,
  getReel,
  listReelSeries,
  listArtStyles,
  listFonts,
  listImageModels,
  listYouTubeChannels,
  listTtsVoices,
  mediaUrl,
  regenerateReel,
  regenerateScene,
  removeScene,
  replanReel,
  resumeFailedReel,
  discardEditDraft,
  saveEditDraft,
  updateCaptions,
  applyCaptions,
  updateRedditCard,
  updateReelSettings,
  updateScene,
  listGameplay,
  listStylePresets,
  publishReel,
  reorderScenes,
  type ArtStyleOption,
  type CaptionStyle,
  type EditEffects,
  type FfmpegCapability,
  type FontOption,
  type GameplayClip,
  type ImageModelOption,
  type OutroSettings,
  type Reel,
  type Scene,
  type StylePreset,
  type TtsVoiceOption,
  type YouTubeChannelOption,
  assertFfmpegReady,
  ffmpegBlockFromError,
} from "@/api/reels";
import { listHorrorReferences, type HorrorReference } from "@/api/trends";
import { EditEffectsControls } from "@/components/reels/EditEffectsControls";
import { CaptionSmokeButton } from "@/components/reels/CaptionSmokeDialog";
import { FfmpegBlockModal } from "@/components/reels/FfmpegBlockModal";
import { ReelStatusChip } from "@/components/reels/ReelStatusChip";
import { VoiceVariantsPanel } from "@/components/reels/VoiceVariantsPanel";
import { Button, buttonClassName } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelTitle } from "@/components/ui/panel";
import { MOTION_MODES } from "@/constants/reels";
import { cn } from "@/lib/utils";
import {
  anchorYFromMarginV,
  canonicalCaptionStyle,
  captionPreviewFontSize,
  captionPreviewPosition,
  captionStylePayload,
  marginVFromDragY,
} from "@/utils/caption-ass";
import {
  gameplayRerenderCostsCredits,
  REEL_ACTIVE_STATUSES,
  reelNeedsPolling,
  reelStudioLocked,
} from "@/utils/reel";

const route = getRouteApi("/studio/$id");

// Mirror of server DEFAULT_CAPTION_STYLE (reel-render buildPortraitKaraoke).
const CAPTION_DEFAULTS: Required<Omit<CaptionStyle, "animation">> & {
  animation: "none" | "pop";
} = {
  fontName: "Arial",
  fontSize: 64,
  primaryColor: "#FFFFFF",
  activeColor: "#FFD700",
  outlineColor: "#000000",
  outlineWidth: 4,
  shadow: 2,
  alignment: 2,
  marginV: 320,
  marginL: 90,
  marginR: 90,
  chunkSize: 4,
  bold: true,
  uppercase: false,
  animation: "none",
  karaoke: false,
};

const CAPTION_STYLE_DEFAULTS = {
  ...CAPTION_DEFAULTS,
  animation: CAPTION_DEFAULTS.animation,
} as const;

const VOICE_POST_PROFILES: {
  value: NonNullable<Reel["audioPost"]>["voiceProfile"];
  label: string;
}[] = [
  { value: "horror", label: "Dark narrator - low, compressed, room echo" },
  { value: "whisper", label: "Whisper room - close, breathy, uneasy" },
  { value: "phone", label: "Phone recording - narrow, distorted call" },
  { value: "tape", label: "Analog tape - degraded recorder, slight wobble" },
  { value: "distant", label: "Distant basement - muffled, far-room echo" },
  { value: "none", label: "Clean - no voice FX" },
];

type InspectorTab = "source" | "look" | "effects" | "outro" | "thumbnail" | "captions" | "export";

const INSPECTOR_TABS: {
  id: InspectorTab;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: "source", label: "Source", icon: <Layers size={15} /> },
  { id: "look", label: "Look", icon: <Palette size={15} /> },
  { id: "effects", label: "Effects", icon: <SlidersHorizontal size={15} /> },
  { id: "outro", label: "Outro", icon: <Youtube size={15} /> },
  { id: "thumbnail", label: "Thumb", icon: <ImageIcon size={15} /> },
  { id: "captions", label: "Captions", icon: <Captions size={15} /> },
  { id: "export", label: "Render", icon: <Settings2 size={15} /> },
];

interface ConfirmAction {
  title: string;
  body: string;
  details?: string[];
  confirmLabel: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
}

type StudioRun = (
  action: () => Promise<Reel>,
  opts?: { requireFfmpeg?: boolean }
) => Promise<void>;

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

  // Poll while produce / revoice / YouTube publish (or any other in-flight job) may
  // still mutate the reel. Publish + revoice leave status=completed, so status-only
  // polling never picks them up. Depend on the boolean, not `reel`, so each refresh
  // doesn't tear down and restart the interval. When polling stops, one trailing
  // refresh catches auto-publish flipping youtube→pending right after completed.
  useEffect(() => {
    if (needsPoll) {
      void refresh();
      const t = setInterval(() => void refresh(), 2500);
      return () => clearInterval(t);
    }
    const settle = setTimeout(() => void refresh(), 2000);
    return () => clearTimeout(settle);
  }, [needsPoll, refresh]);

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
  // Gameplay reels never store per-scene stills/narration URLs (TTS is inline at
  // render), so missing assetUrl/audioUrl is normal — not a pending look change.
  const clearedImages =
    !isGameplay && scenes.some((s) => !s.assetUrl && !s.isHero);
  const clearedAudio = !isGameplay && scenes.some((s) => !s.audioUrl);
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
            ? `Job in progress (${reel.status.replace(/_/g, " ")}) — edits and re-renders are locked.`
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
                    ? "Re-runs TTS + gameplay composite. This spends OpenRouter narration credits again."
                    : "Reuses scene images and narration already on S3, then re-renders.",
                  details: isGameplay
                    ? [
                        "Gameplay reels re-narrate every sentence on each produce run.",
                        "Cost is added to this reel's cost breakdown when the job finishes.",
                      ]
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
              "Renders captions, horror mix, edit FX, outro, and preview video after assets are ready.",
              "Spend is recorded on this reel's cost breakdown when the job finishes.",
            ],
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
            onSelectScene={setSelectedSceneIndex}
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
            onSelectScene={setSelectedSceneIndex}
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
            onTabChange={setInspectorTab}
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

function EditorPanel({
  title,
  icon,
  actions,
  className,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-lg border border-border bg-card", className)}>
      <div className="flex min-h-10 items-center justify-between gap-3 border-b border-border px-3 py-2">
        <strong className="section-label inline-flex min-w-0 items-center gap-2">
          {icon ? <span className="text-muted-foreground/70">{icon}</span> : null}
          <span className="truncate">{title}</span>
        </strong>
        {actions}
      </div>
      {children}
    </section>
  );
}

function ProjectPanel({
  reel,
  seriesReels,
  currentId,
  scenes,
  selectedSceneIndex,
  onSelectScene,
}: {
  reel: Reel;
  seriesReels: Reel[];
  currentId: string;
  scenes: Scene[];
  selectedSceneIndex: number;
  onSelectScene: (index: number) => void;
}) {
  return (
    <EditorPanel
      title="Project"
      icon={<Layers size={15} />}
      className="overflow-hidden xl:max-h-[calc(100vh-73px)]"
    >
      <div className="grid min-w-0 gap-3 overflow-x-hidden p-3 xl:max-h-[calc(100vh-128px)] xl:overflow-y-auto">
        <ReelContextBar
          reel={reel}
          seriesReels={seriesReels}
          currentId={currentId}
        />
        <div className="grid gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Scene bin</span>
            <span>{scenes.length} clips</span>
          </div>
          <div className="grid gap-1.5">
            {scenes.map((scene) => (
              <button
                key={scene.index}
                type="button"
                onClick={() => onSelectScene(scene.index)}
                className={cn(
                  "grid grid-cols-[42px_1fr] items-center gap-2 rounded-md border p-1.5 text-left transition-colors",
                  selectedSceneIndex === scene.index
                    ? "border-primary/70 bg-primary/10"
                    : "border-border bg-background hover:border-input hover:bg-accent",
                )}
              >
                <SceneThumb reel={reel} scene={scene} className="w-[42px]" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-foreground">
                    {String(scene.index + 1).padStart(2, "0")} ·{" "}
                    {scene.narration || "Untitled beat"}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground/80">
                    {scene.motion.type}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </EditorPanel>
  );
}

function ProgramMonitor({
  reel,
  previewUrl,
  variantPreview,
  onClearVariantPreview,
}: {
  reel: Reel;
  previewUrl?: string;
  variantPreview?: boolean;
  onClearVariantPreview?: () => void;
}) {
  return (
    <EditorPanel
      title={
        variantPreview
          ? "Program monitor · voice variant preview"
          : reel.editDraft
            ? "Program monitor · local draft"
            : "Program monitor"
      }
      icon={<Play size={15} />}
      actions={
        <div className="flex items-center gap-1.5">
          {variantPreview ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClearVariantPreview}
            >
              Back to output
            </Button>
          ) : null}
          <span className="rounded-full border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground">
            9:16
          </span>
        </div>
      }
      className="overflow-hidden"
    >
      <div className="grid place-items-center bg-black/20 p-4">
        {variantPreview ? (
          <p className="mb-2 max-w-[360px] text-center text-[11px] text-muted-foreground">
            Previewing a voice take. Click{" "}
            <span className="font-medium text-foreground">Use in studio</span>{" "}
            under Voice Variants to make it the reel output.
          </p>
        ) : null}
        {previewUrl ? (
          <div className="grid w-full max-w-[360px] place-items-center">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              key={previewUrl}
              src={previewUrl}
              controls
              className="relative aspect-9/16 max-h-[50vh] w-full rounded-lg border border-border bg-black xl:max-h-[46vh]"
            />
          </div>
        ) : (
          <div className="grid aspect-9/16 max-h-[50vh] w-full max-w-[360px] place-items-center rounded-lg border border-border bg-black text-sm text-muted-foreground/80 xl:max-h-[46vh]">
            No preview yet
          </div>
        )}
      </div>
    </EditorPanel>
  );
}

function SceneThumb({
  reel,
  scene,
  className,
}: {
  reel: Reel;
  scene: Scene;
  className?: string;
}) {
  const draftAsset = reel.editDraft?.sceneAssets.find(
    (item) => item.index === scene.index,
  );
  const imageUrl = mediaUrl(draftAsset?.assetUrl) ?? scene.assetUrl;
  return (
    <span
      className={cn(
        "grid aspect-9/16 place-items-center overflow-hidden rounded border border-border bg-black/45 text-muted-foreground/80",
        className,
      )}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <ImageIcon size={16} />
      )}
    </span>
  );
}

function TimelinePanel({
  reelId,
  reel,
  scenes,
  selectedSceneIndex,
  onSelectScene,
  busy,
  disabled,
  onAddScene,
  run,
}: {
  reelId: string;
  reel: Reel;
  scenes: Scene[];
  selectedSceneIndex: number;
  onSelectScene: (index: number) => void;
  busy: boolean;
  disabled: boolean;
  onAddScene: () => void;
  run: StudioRun;
}) {
  const totalDuration = scenes.reduce((sum, scene) => sum + Math.max(scene.duration || 0, 0), 0);
  // Clip width tracks real duration so the timeline reads like an NLE — clamped
  // so tiny scenes stay clickable and one long scene can't crowd out the rest.
  const clipWidth = (scene: Scene) => {
    if (!totalDuration) return 132;
    const share = Math.max(scene.duration || 0, 0) / totalDuration;
    return Math.round(Math.min(Math.max(share * scenes.length * 132, 104), 260));
  };
  // order[newPos] = oldPos — swap adjacent positions to move a scene.
  const moveScene = (from: number, to: number) => {
    if (to < 0 || to >= scenes.length) return;
    const order = scenes.map((_, i) => i);
    [order[from], order[to]] = [order[to], order[from]];
    void run(async () => {
      const next = await reorderScenes(reelId, order);
      onSelectScene(to);
      return next;
    });
  };

  return (
    <EditorPanel
      title={`Timeline · ${totalDuration.toFixed(1)}s`}
      icon={<Scissors size={15} />}
      actions={
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={busy || disabled || selectedSceneIndex <= 0}
            title="Move selected scene earlier"
            onClick={() => moveScene(selectedSceneIndex, selectedSceneIndex - 1)}
          >
            <ChevronLeft size={15} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={busy || disabled || selectedSceneIndex >= scenes.length - 1}
            title="Move selected scene later"
            onClick={() => moveScene(selectedSceneIndex, selectedSceneIndex + 1)}
          >
            <ChevronRight size={15} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || disabled}
            onClick={onAddScene}
          >
            + Add {reel.strategy === "gameplay_overlay" ? "sentence" : "scene"}
          </Button>
        </div>
      }
    >
      <div className="grid min-w-0 gap-2 p-3">
        <div className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)] items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
            Video
          </span>
          <div className="studio-scrollbar min-w-0 overflow-x-auto pb-1">
            <div className="flex w-max gap-1.5">
              {scenes.map((scene) => (
                <button
                  key={scene.index}
                  type="button"
                  onClick={() => onSelectScene(scene.index)}
                  style={{ width: clipWidth(scene) }}
                  className={cn(
                    "relative grid grid-cols-[34px_1fr] items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors",
                    selectedSceneIndex === scene.index
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:border-input",
                  )}
                >
                  <SceneThumb reel={reel} scene={scene} className="w-[34px]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-medium text-foreground">
                      Scene {scene.index + 1}
                    </span>
                    <span className="block text-[10px] tabular-nums text-muted-foreground/80">
                      {Math.max(scene.duration || 0, 0).toFixed(1)}s
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)] items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
            Audio
          </span>
          <div className="studio-scrollbar min-w-0 overflow-x-auto pb-1">
            <div className="flex w-max gap-1.5">
              {scenes.map((scene) => (
                <button
                  key={scene.index}
                  type="button"
                  onClick={() => onSelectScene(scene.index)}
                  style={{ width: clipWidth(scene) }}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2 py-2 text-left transition-colors",
                    selectedSceneIndex === scene.index
                      ? "border-success/70 bg-success/10"
                      : "border-border bg-background hover:border-input",
                  )}
                >
                  <Volume2 size={14} className="shrink-0 text-success" />
                  <span className="truncate text-[11px] font-medium text-muted-foreground">
                    Narration {scene.index + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </EditorPanel>
  );
}

function InspectorPanel({
  tab,
  onTabChange,
  reel,
  busy,
  isGameplay,
  run,
  requestConfirm,
}: {
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  reel: Reel;
  busy: boolean;
  isGameplay: boolean;
  run: StudioRun;
  requestConfirm: (action: ConfirmAction) => void;
}) {
  const tabs = isGameplay
    ? INSPECTOR_TABS.filter((item) => item.id !== "look" && item.id !== "effects")
    : INSPECTOR_TABS;

  useEffect(() => {
    if (!isGameplay) return;
    if (tab === "look" || tab === "effects") onTabChange("source");
  }, [isGameplay, tab, onTabChange]);

  return (
    <EditorPanel
      title="Inspector"
      icon={<Settings2 size={15} />}
      className="overflow-hidden xl:max-h-[calc(100vh-73px)]"
    >
      <div className="border-b border-border bg-background">
        <div className="studio-scrollbar flex min-w-0 gap-1 overflow-x-auto overscroll-x-contain p-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={cn(
                "inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                item.id === "thumbnail" ? "min-w-[92px]" : "min-w-[86px]",
                tab === item.id
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0 overflow-x-hidden p-3 xl:max-h-[calc(100vh-164px)] xl:overflow-y-auto">
        {tab === "source" ? (
          isGameplay ? (
            <RedditSourcePanel
              reel={reel}
              busy={busy}
              run={run}
              requestConfirm={requestConfirm}
            />
          ) : (
            <StoryPanel
              reel={reel}
              busy={busy}
              run={run}
              requestConfirm={requestConfirm}
            />
          )
        ) : null}
        {tab === "look" && !isGameplay ? (
          <PresetsPanel
            reel={reel}
            busy={busy}
            run={run}
            requestConfirm={requestConfirm}
          />
        ) : null}
        {tab === "effects" && !isGameplay ? (
          <EffectsPanel
            reel={reel}
            busy={busy}
            run={run}
            requestConfirm={requestConfirm}
          />
        ) : null}
        {tab === "outro" ? (
          <OutroPanel
            reel={reel}
            busy={busy}
            run={run}
            requestConfirm={requestConfirm}
          />
        ) : null}
        {tab === "thumbnail" ? (
          <ThumbnailPanel reel={reel} />
        ) : null}
        {tab === "captions" ? (
          <CaptionEditor
            reel={reel}
            busy={busy}
            run={run}
            requestConfirm={requestConfirm}
          />
        ) : null}
        {tab === "export" ? (
          <div className="grid gap-3">
            <RegeneratePanel
              reel={reel}
              busy={busy}
              run={run}
              requestConfirm={requestConfirm}
            />
            <PublishPanel
              reel={reel}
              busy={busy}
              run={run}
              requestConfirm={requestConfirm}
            />
            <CostPanel reel={reel} />
          </div>
        ) : null}
      </div>
    </EditorPanel>
  );
}

function EditDraftBanner({
  reel,
  busy,
  run,
}: {
  reel: Reel;
  busy: boolean;
  run: StudioRun;
}) {
  if (!reel.editDraft) return null;
  const reelKey = reel._id ?? reel.id ?? "";
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm text-warning">
      <div>
        <div className="font-semibold">Unsaved editor draft</div>
        <div className="text-xs">
          Preview assets are local only. Save uploads to S3 and removes replaced
          scene assets and the previous output video.
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="default"
          disabled={busy}
          onClick={() => void run(() => saveEditDraft(reelKey))}
        >
          Save changes
        </Button>
        <Button
          type="button"
          size="default"
          variant="outline"
          disabled={busy}
          onClick={() => void run(() => discardEditDraft(reelKey))}
        >
          Discard
        </Button>
      </div>
    </div>
  );
}

function ConfirmModal({
  action,
  busy,
  onClose,
}: {
  action?: ConfirmAction;
  busy: boolean;
  onClose: () => void;
}) {
  if (!action) return null;
  const confirm = async () => {
    await action.onConfirm();
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4">
      <div className="grid w-full max-w-md gap-3 rounded-lg border border-border bg-card p-4 shadow-pop">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <strong className="text-base text-foreground">{action.title}</strong>
            <p className="m-0 text-sm leading-relaxed text-muted-foreground">
              {action.body}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={busy}
            onClick={onClose}
            className="text-muted-foreground hover:bg-accent"
          >
            <X size={16} />
          </Button>
        </div>
        {action.details?.length ? (
          <div className="grid gap-1 rounded-md border border-border bg-background p-2.5 text-xs text-muted-foreground">
            {action.details.map((detail) => (
              <div key={detail} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{detail}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={
              action.variant === "destructive" ? "destructive" : "default"
            }
            disabled={busy}
            onClick={() => void confirm()}
          >
            {busy ? <Loader2 className="animate-spin" size={15} /> : null}
            {action.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function reelKey(reel: Reel): string {
  return reel._id ?? reel.id ?? "";
}

function ReelContextBar({
  reel,
  seriesReels,
  currentId,
}: {
  reel: Reel;
  seriesReels: Reel[];
  currentId: string;
}) {
  const isSeries = Boolean(reel.seriesId && (reel.partCount ?? 1) > 1);
  if (!isSeries) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs">
        <span className="font-semibold text-foreground">Standalone reel</span>
        <span className="text-muted-foreground/80">
          Scenes, voice, captions, and render settings apply only to this reel.
        </span>
      </div>
    );
  }

  const parts = seriesReels.length ? seriesReels : [reel];
  return (
    <div className="grid gap-2 rounded-md border border-border bg-background px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs">
          <span className="font-semibold text-foreground">Series</span>
          <span className="ml-2 text-muted-foreground/80">
            Part {reel.partNumber ?? 1} of {reel.partCount ?? parts.length}
          </span>
        </div>
        <span className="text-[11px] font-medium text-muted-foreground/80">
          Edit and generate each part independently.
        </span>
      </div>
      <div className="grid min-w-0 gap-1.5">
        {parts.map((part) => {
          const id = reelKey(part);
          const active = id === currentId;
          return (
            <Link
              key={id || `${part.partNumber}`}
              to="/studio/$id"
              params={{ id }}
              className={cn(
                "grid min-w-0 gap-1 rounded-md border px-3 py-2 text-left text-xs no-underline",
                active
                  ? "border-primary/70 bg-primary/10"
                  : "border-border bg-card hover:bg-secondary",
              )}
            >
              <span className="font-semibold text-foreground">
                Part {part.partNumber ?? 1}
              </span>
              <span className="truncate text-muted-foreground/80">
                {part.title || part.topic || "Untitled"}
              </span>
              <ReelStatusChip
                size="sm"
                status={part.status}
                label={part.status === "plan_review" ? "review" : undefined}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function GateBanner({
  reel,
  busy,
  onApprove,
}: {
  reel: Reel;
  busy: boolean;
  onApprove: () => void;
}) {
  if (reel.status !== "plan_review") return null;
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        <Sparkles size={18} className="text-warning" />
        <span className="font-medium text-foreground">
          {reel.partCount && reel.partCount > 1
            ? `Part ${reel.partNumber ?? 1} plan ready — review & edit this episode below.`
            : reel.strategy === "gameplay_overlay"
              ? "Plan ready — review & edit the title card, sentences, captions, and thumbnail below."
              : "Plan ready — review & edit the script, art, voice, and captions below."}
        </span>
        <span className="text-muted-foreground">
          {reel.strategy === "gameplay_overlay"
            ? "No TTS or render yet (no spend)."
            : "No images/voice have been generated yet (no spend)."}
        </span>
      </div>
      <Button
        type="button"
        variant="default"
        disabled={busy}
        onClick={onApprove}
      >
        {busy ? (
          <Loader2 className="animate-spin" size={16} />
        ) : (
          <CheckCircle2 size={16} />
        )}
        Generate reel
      </Button>
    </div>
  );
}

function RedditSourcePanel({
  reel,
  busy,
  run,
  requestConfirm,
}: {
  reel: Reel;
  busy: boolean;
  run: StudioRun;
  requestConfirm: (action: ConfirmAction) => void;
}) {
  const reelKey = reel._id ?? reel.id ?? "";
  const story = reel.redditStory;
  const [title, setTitle] = useState(story?.title ?? reel.title ?? "");
  const [subreddit, setSubreddit] = useState(story?.subreddit ?? "");
  const [cardUsername, setCardUsername] = useState(story?.cardUsername ?? story?.author ?? "");
  const [ageHours, setAgeHours] = useState(String(story?.ageHours ?? ""));
  const [upvotes, setUpvotes] = useState(String(story?.upvotes ?? ""));
  const [comments, setComments] = useState(String(story?.comments ?? ""));
  const [clips, setClips] = useState<GameplayClip[]>([]);
  const [gameplayKey, setGameplayKey] = useState(reel.gameplayKey ?? "");

  useEffect(() => {
    setTitle(story?.title ?? reel.title ?? "");
    setSubreddit(story?.subreddit ?? "");
    setCardUsername(story?.cardUsername ?? story?.author ?? "");
    setAgeHours(String(story?.ageHours ?? ""));
    setUpvotes(String(story?.upvotes ?? ""));
    setComments(String(story?.comments ?? ""));
    setGameplayKey(reel.gameplayKey ?? "");
  }, [story, reel.title, reel.gameplayKey]);

  useEffect(() => {
    void listGameplay()
      .then(setClips)
      .catch(() => setClips([]));
  }, []);

  const cardDirty =
    title !== (story?.title ?? reel.title ?? "") ||
    subreddit !== (story?.subreddit ?? "") ||
    cardUsername !== (story?.cardUsername ?? story?.author ?? "") ||
    ageHours !== String(story?.ageHours ?? "") ||
    upvotes !== String(story?.upvotes ?? "") ||
    comments !== String(story?.comments ?? "");

  const parseOptionalInt = (value: string) => {
    if (!value.trim()) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : undefined;
  };

  const canBakeIntoVideo =
    reel.status === "completed" || reel.status === "failed";

  async function saveTitleCard(andRerender: boolean) {
    if (andRerender) {
      requestConfirm({
        title: "Save title card & re-render?",
        body: "Gameplay re-renders re-run OpenRouter TTS for the title and every sentence, then rebuild the video.",
        details: [
          "OpenRouter narration credits will be charged.",
          "Spend is added to this reel's cost breakdown when the job finishes.",
          "A job already in progress cannot be stacked.",
        ],
        confirmLabel: "Spend credits & re-render",
        onConfirm: () =>
          run(async () => {
            await updateRedditCard(reelKey, {
              title: title.trim(),
              subreddit,
              cardUsername,
              ageHours: parseOptionalInt(ageHours),
              upvotes: parseOptionalInt(upvotes),
              comments: parseOptionalInt(comments),
            });
            return regenerateReel(reelKey, "render_only");
          }),
      });
      return;
    }
    await run(() =>
      updateRedditCard(reelKey, {
        title: title.trim(),
        subreddit,
        cardUsername,
        ageHours: parseOptionalInt(ageHours),
        upvotes: parseOptionalInt(upvotes),
        comments: parseOptionalInt(comments),
      }),
    );
  }

  return (
    <div className="grid gap-3">
      <PanelTitle className="text-foreground">Title card</PanelTitle>
      <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
        Shown over gameplay while the title is spoken. Sentence scenes below are the spoken body.
        Saving only updates metadata — bake into the video with re-render.
      </p>

      <Label className="gap-1 text-xs text-muted-foreground">
        Title
        <Input
          value={title}
          disabled={busy}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Label>
      <div className="grid grid-cols-2 gap-2">
        <Label className="gap-1 text-xs text-muted-foreground">
          Subreddit
          <Input
            value={subreddit}
            disabled={busy}
            placeholder="r/AmItheAsshole"
            onChange={(e) => setSubreddit(e.target.value)}
          />
        </Label>
        <Label className="gap-1 text-xs text-muted-foreground">
          Username
          <Input
            value={cardUsername}
            disabled={busy}
            placeholder="u/throwaway_1234"
            onChange={(e) => setCardUsername(e.target.value)}
          />
        </Label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Label className="gap-1 text-xs text-muted-foreground">
          Age (hours)
          <Input
            type="number"
            min={0}
            value={ageHours}
            disabled={busy}
            onChange={(e) => setAgeHours(e.target.value)}
          />
        </Label>
        <Label className="gap-1 text-xs text-muted-foreground">
          Upvotes
          <Input
            type="number"
            min={0}
            value={upvotes}
            disabled={busy}
            onChange={(e) => setUpvotes(e.target.value)}
          />
        </Label>
        <Label className="gap-1 text-xs text-muted-foreground">
          Comments
          <Input
            type="number"
            min={0}
            value={comments}
            disabled={busy}
            onChange={(e) => setComments(e.target.value)}
          />
        </Label>
      </div>
      <div className="grid gap-2">
        <Button
          type="button"
          variant={cardDirty ? "default" : "outline"}
          disabled={busy || !cardDirty || !title.trim()}
          onClick={() => void saveTitleCard(false)}
        >
          {cardDirty ? "Save title card" : "Saved"}
        </Button>
        {canBakeIntoVideo ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !title.trim()}
            onClick={() => void saveTitleCard(true)}
          >
            {busy ? (
              <Loader2 className="animate-spin" size={15} />
            ) : (
              <RefreshCw size={15} />
            )}
            {cardDirty
              ? "Save & re-render video"
              : "Re-render title card into video"}
          </Button>
        ) : null}
      </div>

      <PanelTitle className="mt-2 text-foreground">Gameplay clip</PanelTitle>
      <Label className="gap-1 text-xs text-muted-foreground">
        Background
        <Select
          disabled={busy}
          value={gameplayKey}
          onChange={(e) => {
            const next = e.target.value;
            setGameplayKey(next);
            void run(() =>
              updateReelSettings(reelKey, {
                gameplayKey: next || undefined,
              }),
            );
          }}
        >
          <option value="">Random from S3 pool</option>
          {clips.map((clip) => (
            <option key={clip.key} value={clip.key}>
              {clip.filename}
            </option>
          ))}
        </Select>
      </Label>
      {canBakeIntoVideo ? (
        <p className="m-0 text-[11px] leading-relaxed text-muted-foreground/80">
          Clip choice is saved immediately. Use{" "}
          <span className="font-medium text-foreground">
            Re-render title card into video
          </span>{" "}
          above (or Export → Re-render) to bake the new background — that
          re-runs TTS with the current studio voice.
        </p>
      ) : null}
    </div>
  );
}

function StoryPanel({
  reel,
  busy,
  run,
  requestConfirm,
}: {
  reel: Reel;
  busy: boolean;
  run: StudioRun;
  requestConfirm: (action: ConfirmAction) => void;
}) {
  const [script, setScript] = useState(reel.providedScript ?? "");
  const [references, setReferences] = useState<HorrorReference[]>([]);
  const bible = reel.storyBible;
  const reelKey = reel._id ?? reel.id ?? "";

  useEffect(() => {
    void listHorrorReferences(12)
      .then(setReferences)
      .catch(() => setReferences([]));
  }, []);

  return (
    <div className="grid gap-3">
      <PanelTitle className="text-foreground">Story source</PanelTitle>

      {reel.horrorReference ? (
        <div className="rounded-md border border-border bg-card p-2.5 text-xs">
          <div className="font-medium text-foreground">Reference used</div>
          <a
            href={reel.horrorReference.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary"
          >
            {reel.horrorReference.title} <ExternalLink size={12} />
          </a>
          <span className="ml-1 text-muted-foreground/80">
            {reel.horrorReference.author
              ? `· ${reel.horrorReference.author}`
              : ""}{" "}
            {reel.horrorReference.license ?? ""}
          </span>
        </div>
      ) : null}

      {bible ? (
        <div className="grid gap-1 rounded-md border border-border bg-card p-2.5 text-xs">
          <div className="font-medium text-foreground">{bible.premise}</div>
          <div className="text-muted-foreground/80">
            Anchor: {bible.anchorObject} · Rule: {bible.impossibleRule}
          </div>
          <div className="text-muted-foreground/80">Twist: {bible.finalTwist}</div>
        </div>
      ) : null}

      <Label className="text-muted-foreground">
        Pick a scraped reference (optional)
        <Select
          disabled={busy}
          value={reel.horrorReferenceId ?? ""}
          onChange={(e) => {
            const horrorReferenceId = e.target.value;
            requestConfirm({
              title: "Re-plan with this reference?",
              body: "Discards the current plan and runs OpenRouter script planning again.",
              details: [
                "LLM planning credits will be charged.",
                "Existing scene assets are cleared until you approve and produce again.",
              ],
              confirmLabel: "Spend credits & re-plan",
              onConfirm: () => run(() => replanReel(reelKey, { horrorReferenceId })),
            });
          }}
        >
          <option value="">Auto / none</option>
          {references.map((r) => (
            <option key={r._id ?? r.sourceUrl} value={r._id ?? ""}>
              {r.title}
              {r.author ? ` — ${r.author}` : ""}
            </option>
          ))}
        </Select>
      </Label>

      <Label className="text-muted-foreground">
        Bring your own story (replaces AI script)
        <Textarea
          rows={5}
          value={script}
          disabled={busy}
          placeholder="Paste your full story here. It will be split into scenes, keeping your words."
          onChange={(e) => setScript(e.target.value)}
        />
      </Label>
      <Button
        type="button"
        variant="outline"
        className="border-border bg-secondary text-foreground hover:bg-accent"
        disabled={busy || !script.trim()}
        onClick={() =>
          requestConfirm({
            title: "Re-plan from your story?",
            body: "Structures your pasted story into scenes with OpenRouter, replacing the current plan.",
            details: [
              "LLM planning credits will be charged.",
              "Existing scene assets are cleared until you approve and produce again.",
            ],
            confirmLabel: "Spend credits & re-plan",
            onConfirm: () =>
              run(() =>
                replanReel(reelKey, {
                  providedScript: script.trim(),
                }),
              ),
          })
        }
      >
        <RefreshCw size={15} /> Re-plan from my story
      </Button>
    </div>
  );
}

function SceneCard({
  reelId,
  reel,
  scene,
  total,
  busy,
  disabled,
  isGameplay,
  run,
  requestConfirm,
}: {
  reelId: string;
  reel: Reel;
  scene: Scene;
  total: number;
  busy: boolean;
  disabled: boolean;
  isGameplay: boolean;
  run: StudioRun;
  requestConfirm: (action: ConfirmAction) => void;
}) {
  const [narration, setNarration] = useState(scene.narration);
  const [visualPrompt, setVisualPrompt] = useState(scene.visualPrompt);
  const dirty = isGameplay
    ? narration !== scene.narration
    : narration !== scene.narration || visualPrompt !== scene.visualPrompt;

  useEffect(() => {
    setNarration(scene.narration);
    setVisualPrompt(scene.visualPrompt);
  }, [scene.narration, scene.visualPrompt]);

  const disableAll = busy || disabled;
  const draftAsset = reel.editDraft?.sceneAssets.find(
    (item) => item.index === scene.index,
  );
  const imageUrl = mediaUrl(draftAsset?.assetUrl) ?? scene.assetUrl;
  const audioUrl = mediaUrl(draftAsset?.audioUrl) ?? scene.audioUrl;

  return (
    <div className="grid min-w-0 gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-[120px_minmax(0,1fr)]">
      <div className="grid gap-1.5">
        <div className="grid aspect-9/16 w-full place-items-center overflow-hidden rounded-md border border-border bg-black/45 text-muted-foreground/80">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`Scene ${scene.index + 1}`}
              className="h-full w-full object-cover"
            />
          ) : isGameplay ? (
            <span className="px-2 text-center text-[10px] leading-snug">Gameplay bg</span>
          ) : (
            <ImageIcon size={20} />
          )}
        </div>
        <span className="text-center text-[11px] font-medium text-muted-foreground/80">
          {isGameplay ? `Sentence ${scene.index + 1}/${total}` : `Scene ${scene.index + 1}/${total}`}
        </span>
        {audioUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio src={audioUrl} controls className="h-7 w-full" />
        ) : (
          <span className="inline-flex items-center justify-center gap-1 text-[11px] text-muted-foreground/80">
            <Play size={11} /> no audio
          </span>
        )}
      </div>

      <div className="grid min-w-0 gap-2 overflow-hidden">
        <Label className="gap-1 text-xs text-muted-foreground">
          Narration
          <Textarea
            rows={3}
            value={narration}
            disabled={disableAll}
            onChange={(e) => setNarration(e.target.value)}
          />
        </Label>
        {!isGameplay ? (
          <Label className="gap-1 text-xs text-muted-foreground">
            Visual prompt
            <Textarea
              rows={2}
              value={visualPrompt}
              disabled={disableAll}
              onChange={(e) => setVisualPrompt(e.target.value)}
            />
          </Label>
        ) : null}
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {!isGameplay ? (
            <Select
              className="h-8 w-full text-xs sm:w-auto"
              disabled={disableAll}
              value={scene.motion.type}
              onChange={(e) =>
                void run(() =>
                  updateScene(reelId, scene.index, {
                    motion: {
                      ...scene.motion,
                      type: e.target.value as Scene["motion"]["type"],
                    },
                  }),
                )
              }
            >
              <option value="ken_burns">Ken Burns</option>
              <option value="parallax">Parallax</option>
              <option value="static">Static</option>
              <option value="ai_motion">AI motion</option>
            </Select>
          ) : null}
          <Button
            type="button"
            size="default"
            variant={dirty ? "default" : "outline"}
            disabled={disableAll || !dirty}
            onClick={() =>
              void run(() =>
                updateScene(
                  reelId,
                  scene.index,
                  isGameplay ? { narration } : { narration, visualPrompt },
                ),
              )
            }
          >
            {dirty ? "Save" : "Saved"}
          </Button>
          {!isGameplay ? (
            <>
              <Button
                type="button"
                size="default"
                variant="outline"
                className="border-border bg-secondary text-foreground hover:bg-accent"
                disabled={disableAll}
                title="Regenerate this scene's image"
                onClick={() =>
                  requestConfirm({
                    title: `Regenerate image for scene ${scene.index + 1}?`,
                    body: "This makes one new OpenRouter image request, then rebuilds the preview video with existing narration and other scene assets.",
                    details: [
                      "Costs image generation for this scene only.",
                      "Keeps every other scene image.",
                      "Keeps all narration audio.",
                      "Re-burns captions/render output so the preview reflects the new image.",
                    ],
                    confirmLabel: "Regenerate image",
                    onConfirm: () =>
                      run(() => regenerateScene(reelId, scene.index, ["image"])),
                  })
                }
              >
                <ImageIcon size={13} /> Image
              </Button>
              <Button
                type="button"
                size="default"
                variant="outline"
                className="border-border bg-secondary text-foreground hover:bg-accent"
                disabled={disableAll}
                title="Regenerate this scene's narration audio"
                onClick={() =>
                  requestConfirm({
                    title: `Regenerate narration for scene ${scene.index + 1}?`,
                    body: "This makes one new OpenRouter TTS request, then rebuilds the preview video with existing images and other scene audio.",
                    details: [
                      "Costs narration generation for this scene only.",
                      "Keeps every scene image.",
                      "Keeps other scenes' narration audio.",
                      "Caption timing is rebuilt from the new audio duration.",
                    ],
                    confirmLabel: "Regenerate audio",
                    onConfirm: () =>
                      run(() => regenerateScene(reelId, scene.index, ["audio"])),
                  })
                }
              >
                <Play size={13} /> Audio
              </Button>
            </>
          ) : null}
          {total > 1 ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={disableAll}
              onClick={() =>
                requestConfirm({
                  title: `Remove ${isGameplay ? "sentence" : "scene"} ${scene.index + 1}?`,
                  body: isGameplay
                    ? "This removes the sentence from the spoken body. It does not call OpenRouter by itself."
                    : "This removes the scene from the reel plan. It does not call OpenRouter by itself.",
                  confirmLabel: isGameplay ? "Remove sentence" : "Remove scene",
                  variant: "destructive",
                  onConfirm: () => run(() => removeScene(reelId, scene.index)),
                })
              }
            >
              <Trash2 size={15} />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PresetsPanel({
  reel,
  busy,
  run,
  requestConfirm,
}: {
  reel: Reel;
  busy: boolean;
  run: StudioRun;
  requestConfirm: (action: ConfirmAction) => void;
}) {
  const [artStyles, setArtStyles] = useState<ArtStyleOption[]>([]);
  const [imageModels, setImageModels] = useState<ImageModelOption[]>([]);
  const [voices, setVoices] = useState<TtsVoiceOption[]>([]);
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const reelKey = reel._id ?? reel.id ?? "";

  useEffect(() => {
    void listArtStyles("horror")
      .then(setArtStyles)
      .catch(() => undefined);
    void listImageModels()
      .then(setImageModels)
      .catch(() => undefined);
    void listTtsVoices()
      .then(setVoices)
      .catch(() => undefined);
    void listStylePresets(reel.niche)
      .then(setPresets)
      .catch(() => setPresets([]));
  }, [reel.niche]);

  const currentVoice =
    reel.voiceOverride?.voice ?? reel.narrationVoice?.voice ?? "";

  const applyPreset = (preset: StylePreset) =>
    requestConfirm({
      title: `Apply "${preset.displayName}" preset?`,
      body: `${preset.description} This sets art style, motion, voice, voice FX, and caption look in one go.`,
      details: [
        "Existing scene stills and narration are cleared so the new look/voice can generate.",
        "No OpenRouter call happens immediately — the next produce run regenerates them.",
        "Caption style is applied to the next render.",
      ],
      confirmLabel: "Apply preset",
      onConfirm: () =>
        run(async () => {
          await updateReelSettings(reelKey, {
            artStyleId: preset.artStyleId,
            motionMode: preset.motionMode,
            voice: preset.voice,
            audioPost: preset.audioPost,
          });
          return updateCaptions(reelKey, preset.captionStyle);
        }),
    });

  return (
    <div className="grid gap-2.5">
      <PanelTitle className="text-foreground">Look & Voice</PanelTitle>

      {presets.length ? (
        <div className="grid gap-2 rounded-md border border-border bg-card p-2.5">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
            <Sparkles size={14} className="text-primary" /> Style presets
          </span>
          <div className="grid gap-1.5">
            {presets.map((preset) => {
              const active = reel.presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={busy}
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    "grid gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors",
                    active
                      ? "border-primary/60 bg-primary/10"
                      : "border-border bg-background hover:border-input hover:bg-accent",
                  )}
                >
                  <span className="text-xs font-medium text-foreground">
                    {preset.displayName}
                    {active ? <span className="ml-2 text-[10px] font-semibold uppercase text-primary">current</span> : null}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground/80">{preset.description}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground/80">
            One-click bundle of art, motion, voice, voice FX, and caption look.
          </p>
        </div>
      ) : null}

      <Label className="text-xs text-muted-foreground">
        Art style
        <Select
          disabled={busy}
          value={reel.artStyleId ?? ""}
          onChange={(e) => {
            const artStyleId = e.target.value;
            requestConfirm({
              title: "Change art style?",
              body: "This clears existing scene stills because the current images no longer match the selected style.",
              details: [
                "No OpenRouter call happens immediately.",
                "The next asset produce run regenerates scene images.",
                "Narration audio is kept.",
              ],
              confirmLabel: "Change style",
              onConfirm: () =>
                run(() => updateReelSettings(reelKey, { artStyleId })),
            });
          }}
        >
          <option value="">Auto</option>
          {artStyles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.displayName}
            </option>
          ))}
        </Select>
      </Label>

      <Label className="text-xs text-muted-foreground">
        Motion
        <Select
          disabled={busy}
          value={reel.motionMode ?? "ken_burns"}
          onChange={(e) =>
            void run(() =>
              updateReelSettings(reelKey, {
                motionMode: e.target.value as Reel["motionMode"],
              }),
            )
          }
        >
          {MOTION_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </Label>

      <Label className="text-xs text-muted-foreground">
        Image model
        <Select
          disabled={busy}
          value={reel.imageModelOverride ?? ""}
          onChange={(e) => {
            const imageModel = e.target.value;
            requestConfirm({
              title: "Change image model?",
              body: "This clears existing scene stills so future image generation uses the selected model.",
              details: [
                "No OpenRouter call happens immediately.",
                "The next asset produce run regenerates scene images.",
                "Narration audio is kept.",
              ],
              confirmLabel: "Change model",
              onConfirm: () =>
                run(() => updateReelSettings(reelKey, { imageModel })),
            });
          }}
        >
          <option value="">Niche default</option>
          {imageModels.map((m) => (
            <option key={m.model} value={m.model}>
              {m.label}
            </option>
          ))}
        </Select>
      </Label>

      <Label className="text-xs text-muted-foreground">
        Narration voice
        <Select
          disabled={busy}
          value={currentVoice}
          onChange={(e) => {
            const v = voices.find((o) => o.voice === e.target.value);
            if (!v) return;
            requestConfirm({
              title: "Change narration voice?",
              body: "This clears existing scene narration audio so the selected voice can be generated.",
              details: [
                "No OpenRouter call happens immediately.",
                "The next asset produce run regenerates narration audio.",
                "Scene images are kept.",
              ],
              confirmLabel: "Change voice",
              onConfirm: () =>
                run(() =>
                  updateReelSettings(reelKey, {
                    voice: { model: v.model, voice: v.voice, format: v.format },
                  }),
                ),
            });
          }}
        >
          <option value="">Default</option>
          {voices.map((v) => (
            <option key={`${v.model}/${v.voice}`} value={v.voice}>
              {v.label}
            </option>
          ))}
        </Select>
      </Label>

      <Label className="text-xs text-muted-foreground">
        Voice post-processing
        <Select
          disabled={busy}
          value={reel.audioPost?.voiceProfile ?? "horror"}
          onChange={(e) => {
            const voiceProfile = e.target.value as NonNullable<
              Reel["audioPost"]
            >["voiceProfile"];
            requestConfirm({
              title: "Change voice post-processing?",
              body: "Voice FX are baked into the scene narration MP3s, so existing narration audio must be regenerated.",
              details: [
                "No OpenRouter call happens immediately.",
                "The next asset produce run regenerates narration audio with the selected treatment.",
                "Scene images are kept.",
              ],
              confirmLabel: "Change voice FX",
              onConfirm: () =>
                run(() =>
                  updateReelSettings(reelKey, {
                    audioPost: {
                      ...reel.audioPost,
                      voiceProfile,
                    },
                  }),
                ),
            });
          }}
        >
          {VOICE_POST_PROFILES.map((profile) => (
            <option key={profile.value} value={profile.value}>
              {profile.label}
            </option>
          ))}
        </Select>
      </Label>
      <p className="text-[11px] text-muted-foreground/80">
        Changing art/image model clears stills; changing voice or voice FX
        clears narration. Re-render below to apply.
      </p>
    </div>
  );
}

function RegeneratePanel({
  reel,
  busy,
  run,
  requestConfirm,
}: {
  reel: Reel;
  busy: boolean;
  run: StudioRun;
  requestConfirm: (action: ConfirmAction) => void;
}) {
  const reelKey = reel._id ?? reel.id ?? "";
  const canRegen = reel.status === "completed" || reel.status === "failed";
  if (!canRegen) return null;
  const isFailed = reel.status === "failed";
  const isGameplay = reel.strategy === "gameplay_overlay";
  const costsCredits = gameplayRerenderCostsCredits(reel);
  return (
    <div className="grid gap-2">
      <PanelTitle className="text-foreground">Render Queue</PanelTitle>
      {isFailed ? (
        <Button
          type="button"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={busy}
          onClick={() =>
            requestConfirm({
              title: "Resume failed job?",
              body: costsCredits
                ? "Re-runs TTS + gameplay composite. This spends OpenRouter narration credits again."
                : "Reuses scene images and narration already on S3, then re-renders.",
              details: costsCredits
                ? [
                    "Gameplay reels re-narrate every sentence on each produce run.",
                    "Spend is added to this reel's cost breakdown when the job finishes.",
                  ]
                : ["No new image/TTS spend if assets are already on S3."],
              confirmLabel: "Resume",
              onConfirm: () => run(() => resumeFailedReel(reelKey), { requireFfmpeg: true }),
            })
          }
        >
          <RefreshCw size={15} />{" "}
          {isGameplay
            ? "Resume failed job (re-run TTS + render)"
            : "Resume failed job (reuse assets — free)"}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="border-border bg-secondary text-foreground hover:bg-accent"
          disabled={busy}
          onClick={() =>
            requestConfirm({
              title: costsCredits ? "Re-render gameplay reel?" : "Re-render reel?",
              body: costsCredits
                ? "This re-runs OpenRouter TTS for the title + every sentence, then composites over gameplay."
                : "Reuses existing scene images and narration (no OpenRouter spend), then re-renders locally.",
              details: costsCredits
                ? [
                    "OpenRouter narration credits will be charged.",
                    "Spend is added to this reel's cost breakdown when the job finishes.",
                    "A job already in progress cannot be stacked — wait for it to finish.",
                  ]
                : [
                    "Free unless look/voice changes cleared assets (then those regenerate).",
                    "A job already in progress cannot be stacked — wait for it to finish.",
                  ],
              confirmLabel: costsCredits ? "Spend credits & re-render" : "Re-render",
              onConfirm: () => run(() => regenerateReel(reelKey, "render_only"), { requireFfmpeg: true }),
            })
          }
        >
          <RefreshCw size={15} />{" "}
          {isGameplay
            ? "Re-render (re-runs TTS + gameplay composite)"
            : "Re-render (reuse assets — free)"}
        </Button>
      )}
      {!isGameplay ? (
        <Button
          type="button"
          variant="outline"
          className="border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
          disabled={busy}
          onClick={() =>
            requestConfirm({
              title: "Regenerate all assets?",
              body: "This regenerates every scene image and narration clip into a local draft preview.",
              details: [
                "Costs OpenRouter image generation for every scene.",
                "Costs OpenRouter TTS for every scene.",
                "Rebuilds a local preview video without uploading it to S3.",
                "Save uploads the accepted assets; discard deletes the local draft.",
                "Use resume/re-render instead for caption, edit FX, outro, or layout-only changes.",
              ],
              confirmLabel: "Regenerate all assets",
              variant: "destructive",
              onConfirm: () => run(() => regenerateReel(reelKey, "assets"), { requireFfmpeg: true }),
            })
          }
        >
          <Wand2 size={15} /> Regenerate all assets ($)
        </Button>
      ) : null}
    </div>
  );
}

function CostPanel({ reel }: { reel: Reel }) {
  const breakdown = reel.costBreakdown;
  if (!breakdown?.lines?.length) {
    return (
      <div className="grid gap-2">
        <PanelTitle className="inline-flex items-center gap-2 text-foreground">
          <Receipt size={15} className="text-primary" /> Cost breakdown
        </PanelTitle>
        <p className="m-0 text-[11px] text-muted-foreground/80">
          No spend recorded yet. Produce and re-render jobs append OpenRouter
          usage here when they finish.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <PanelTitle className="inline-flex items-center gap-2 text-foreground">
        <Receipt size={15} className="text-primary" /> Cost breakdown
      </PanelTitle>
      <div className="grid gap-1">
        {breakdown.lines.map((line, index) => (
          <div
            key={`${index}-${line.label}-${line.model ?? ""}`}
            className="flex items-baseline justify-between gap-3 text-xs"
          >
            <span className="min-w-0 truncate text-muted-foreground">
              {line.label}
              {line.model ? <span className="text-muted-foreground/60"> · {line.model}</span> : null}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-foreground">
              ${line.costUsd.toFixed(4)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-baseline justify-between border-t border-border/70 pt-2 text-sm">
        <span className="font-medium text-foreground">Total</span>
        <span className="font-semibold tabular-nums text-primary">${breakdown.totalUsd.toFixed(4)}</span>
      </div>
      <p className="m-0 text-[11px] text-muted-foreground/80">
        {breakdown.note ??
          "Re-renders append new lines (prefixed [Re-render]) so totals accumulate."}
      </p>
    </div>
  );
}

function PublishPanel({
  reel,
  busy,
  run,
  requestConfirm,
}: {
  reel: Reel;
  busy: boolean;
  run: StudioRun;
  requestConfirm: (action: ConfirmAction) => void;
}) {
  const reelKey = reel._id ?? reel.id ?? "";
  const [channels, setChannels] = useState<YouTubeChannelOption[]>([]);
  const [channelId, setChannelId] = useState("");

  useEffect(() => {
    void listYouTubeChannels()
      .then(setChannels)
      .catch(() => setChannels([]));
  }, []);

  if (reel.status !== "completed") return null;
  const yt = reel.youtube;
  const selected = channels.find((channel) => channel.id === channelId);

  return (
    <div className="grid gap-2">
      <PanelTitle className="inline-flex items-center gap-2 text-foreground">
        <Youtube size={15} className="text-primary" /> Publish
      </PanelTitle>

      {yt ? (
        <div
          className={cn(
            "rounded-md border px-2.5 py-2 text-xs",
            yt.status === "published"
              ? "border-success/40 bg-success/10 text-success"
              : yt.status === "failed"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-warning/40 bg-warning/10 text-warning",
          )}
        >
          <span className="font-medium capitalize">{yt.status}</span>
          {yt.channelLabel ? ` · ${yt.channelLabel}` : ""}
          {yt.url ? (
            <a href={yt.url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-primary">
              Watch <ExternalLink size={11} />
            </a>
          ) : null}
          {yt.thumbnailStatus ? (
            <div className="mt-1 text-[11px] opacity-90">
              Thumbnail:{" "}
              {yt.thumbnailStatus === "uploaded"
                ? "custom image uploaded"
                : yt.thumbnailStatus === "failed"
                  ? "not uploaded"
                  : yt.thumbnailStatus === "missing"
                    ? "no thumbnail on reel"
                    : yt.thumbnailStatus}
            </div>
          ) : null}
          {yt.shortsCoverStatus ? (
            <div className="mt-0.5 text-[11px] opacity-90">
              Shorts cover:{" "}
              {yt.shortsCoverStatus === "applied"
                ? "vertical shelf image updated"
                : yt.shortsCoverStatus === "unchanged"
                  ? "still an auto video frame — set cover in YouTube Studio"
                  : "could not verify yet"}
            </div>
          ) : null}
          {yt.shortsCoverStatus === "unchanged" ? (
            <div className="mt-0.5 text-[11px] opacity-90">
              YouTube Shorts often keeps a separate auto cover even when the API
              accepts a custom thumb. In YouTube Studio → Content → the Short →
              Details, pick a frame/cover manually if the shelf still looks wrong.
            </div>
          ) : null}
          {yt.thumbnailError ? (
            <div className="mt-0.5 text-[11px] opacity-90">{yt.thumbnailError}</div>
          ) : null}
          {yt.error ? <div className="mt-1 text-[11px] opacity-90">{yt.error}</div> : null}
        </div>
      ) : null}

      <Label className="text-xs text-muted-foreground">
        Channel
        <Select disabled={busy} value={channelId} onChange={(e) => setChannelId(e.target.value)}>
          <option value="">Auto by niche</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.googleChannelTitle || channel.label} · {channel.privacyStatus}
            </option>
          ))}
        </Select>
      </Label>

      <Button
        type="button"
        variant="default"
        disabled={busy || !reel.outputUrl}
        onClick={() =>
          requestConfirm({
            title: yt?.status === "published" ? "Publish again?" : "Publish to YouTube?",
            body: `Uploads the rendered video${selected ? ` to ${selected.googleChannelTitle || selected.label}` : " to the niche's default channel"} with the reviewed title, description, tags, and thumbnail.`,
            details: [
              "Uses the review package (edit it on the Review screen first if needed).",
              "The upload runs in the background — status appears above.",
            ],
            confirmLabel: "Publish",
            onConfirm: () =>
              run(async () => {
                await publishReel(reelKey, channelId || undefined);
                return getReel(reelKey);
              }),
          })
        }
      >
        <Send size={15} /> {yt?.status === "published" ? "Republish" : "Publish to YouTube"}
      </Button>
    </div>
  );
}

// ---- Cinematic edit effects (rain / grain / vignette / letterbox) ----

function EffectsPanel({
  reel,
  busy,
  run,
  requestConfirm,
}: {
  reel: Reel;
  busy: boolean;
  run: StudioRun;
  requestConfirm: (action: ConfirmAction) => void;
}) {
  const reelKey = reel._id ?? reel.id ?? "";
  const [fx, setFx] = useState<EditEffects>(reel.editEffects ?? {});
  useEffect(() => setFx(reel.editEffects ?? {}), [reel.editEffects]);

  return (
    <div className="grid gap-2.5">
      <PanelTitle className="text-foreground">Edit Effects</PanelTitle>
      <EditEffectsControls value={fx} onChange={setFx} disabled={busy} />
      <Button
        type="button"
        variant="default"
        disabled={busy}
        onClick={() =>
          requestConfirm({
            title: "Apply effects & re-render?",
            body: "Render-only pass over the existing video. No OpenRouter image/TTS spend.",
            details: [
              "Reuses every scene still and narration clip.",
              "A job already in progress cannot be stacked.",
            ],
            confirmLabel: "Re-render (free)",
            onConfirm: () =>
              run(async () => {
                await updateReelSettings(reelKey, { editEffects: fx });
                return regenerateReel(reelKey, "render_only");
              }),
          })
        }
      >
        <RefreshCw size={15} /> Apply &amp; re-render (free)
      </Button>
      <p className="text-[11px] text-muted-foreground/80">
        A cinematic finish over the whole reel. Render-only — reuses every
        asset, no generation spend.
      </p>
    </div>
  );
}

function compactOutroSettings(outro: OutroSettings): OutroSettings {
  return Object.fromEntries(
    Object.entries(outro)
      .map(([key, value]) => [key, value?.trim()])
      .filter(([, value]) => Boolean(value)),
  ) as OutroSettings;
}

function channelDisplayName(channel: YouTubeChannelOption): string {
  return channel.googleChannelTitle || channel.label;
}

function channelPurpose(channel: YouTubeChannelOption): string {
  return channel.niches?.length ? channel.niches.join(", ") : "general";
}

function OutroPanel({
  reel,
  busy,
  run,
  requestConfirm,
}: {
  reel: Reel;
  busy: boolean;
  run: StudioRun;
  requestConfirm: (action: ConfirmAction) => void;
}) {
  const reelKey = reel._id ?? reel.id ?? "";
  const [channels, setChannels] = useState<YouTubeChannelOption[]>([]);
  const [outroChannelId, setOutroChannelId] = useState(reel.outroChannelId ?? "");
  const [outro, setOutro] = useState<OutroSettings>(reel.outro ?? {});

  useEffect(() => {
    void listYouTubeChannels()
      .then(setChannels)
      .catch(() => setChannels([]));
  }, []);

  useEffect(() => {
    setOutroChannelId(reel.outroChannelId ?? "");
    setOutro(reel.outro ?? {});
  }, [reel.outro, reel.outroChannelId]);

  const selected = channels.find((channel) => channel.id === outroChannelId);
  const patchOutro = (patch: Partial<OutroSettings>) =>
    setOutro((current) => ({ ...current, ...patch }));

  return (
    <div className="grid gap-2.5">
      <PanelTitle className="text-foreground">Outro</PanelTitle>

      <Label className="text-xs text-muted-foreground">
        Brand channel
        <Select
          disabled={busy}
          value={outroChannelId}
          onChange={(event) => setOutroChannelId(event.target.value)}
        >
          <option value="">Auto by niche</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channelDisplayName(channel)} · {channelPurpose(channel)} · {channel.privacyStatus}
            </option>
          ))}
        </Select>
      </Label>

      {selected ? (
        <div className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          The outro will use {channelDisplayName(selected)} unless you override the display name below.
        </div>
      ) : null}

      <Label className="text-xs text-muted-foreground">
        Display name override
        <Input
          disabled={busy}
          value={outro.channelName ?? ""}
          placeholder={selected ? channelDisplayName(selected) : "Auto channel name"}
          onChange={(event) => patchOutro({ channelName: event.target.value })}
        />
      </Label>

      <Label className="text-xs text-muted-foreground">
        Handle override
        <Input
          disabled={busy}
          value={outro.channelHandle ?? ""}
          placeholder="@channel"
          onChange={(event) => patchOutro({ channelHandle: event.target.value })}
        />
      </Label>

      <Label className="text-xs text-muted-foreground">
        Spoken outro line
        <Textarea
          rows={2}
          disabled={busy}
          value={outro.spokenLine ?? ""}
          placeholder={
            reel.niche === "reddit"
              ? "Follow Channel Name for more stories."
              : "Subscribe to Channel Name. The next story is already waiting."
          }
          onChange={(event) => patchOutro({ spokenLine: event.target.value })}
        />
      </Label>

      <div className="grid gap-2 sm:grid-cols-2">
        <Label className="text-xs text-muted-foreground">
          Card title
          <Input
            disabled={busy}
            value={outro.title ?? ""}
            placeholder={reel.niche.startsWith("horror") ? "DON'T WATCH ALONE" : "FOLLOW FOR MORE"}
            onChange={(event) => patchOutro({ title: event.target.value })}
          />
        </Label>
        <Label className="text-xs text-muted-foreground">
          Card subtitle
          <Input
            disabled={busy}
            value={outro.subtitle ?? ""}
            placeholder={reel.niche.startsWith("horror") ? "New nightmares every night" : "More stories after this one"}
            onChange={(event) => patchOutro({ subtitle: event.target.value })}
          />
        </Label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Label className="text-xs text-muted-foreground">
          CTA button
          <Input
            disabled={busy}
            value={outro.cta ?? ""}
            placeholder="SUBSCRIBE"
            onChange={(event) => patchOutro({ cta: event.target.value })}
          />
        </Label>
        <Label className="text-xs text-muted-foreground">
          Footer
          <Input
            disabled={busy}
            value={outro.footer ?? ""}
            placeholder={reel.niche.startsWith("horror") ? "it already knows you're here" : ""}
            onChange={(event) => patchOutro({ footer: event.target.value })}
          />
        </Label>
      </div>

      <Button
        type="button"
        variant="default"
        disabled={busy}
        onClick={() =>
          requestConfirm({
            title: "Render outro draft?",
            body: gameplayRerenderCostsCredits(reel)
              ? "Gameplay re-render re-runs OpenRouter TTS for the whole reel (not just the outro), then rebuilds the video."
              : "Rebuilds the outro narration/card and preview. Scene stills and body narration are reused.",
            details: gameplayRerenderCostsCredits(reel)
              ? [
                  "OpenRouter narration credits will be charged for the full gameplay re-TTS.",
                  "Spend is added to this reel's cost breakdown when the job finishes.",
                ]
              : [
                  "Outro spoken line may spend a small OpenRouter TTS amount.",
                  "Body scene assets are kept.",
                ],
            confirmLabel: gameplayRerenderCostsCredits(reel)
              ? "Spend credits & re-render"
              : "Render outro",
            onConfirm: () =>
              run(async () => {
                await updateReelSettings(reelKey, {
                  outroChannelId,
                  outro: compactOutroSettings(outro),
                });
                return regenerateReel(reelKey, "render_only");
              }),
          })
        }
      >
        <RefreshCw size={15} /> Render outro draft
      </Button>
      <p className="text-[11px] text-muted-foreground/80">
        {gameplayRerenderCostsCredits(reel)
          ? "Gameplay path re-narrates the full reel on re-render (OpenRouter TTS)."
          : "Reuses all scene stills and narration. Only the outro narration, outro card, and preview video are rebuilt."}
      </p>
    </div>
  );
}

function ThumbnailPanel({ reel }: { reel: Reel }) {
  const reelKey = reel._id ?? reel.id ?? "";
  const draft = reel.thumbnailDraft;
  return (
    <div className="grid gap-2.5">
      <PanelTitle className="text-foreground">Thumbnail</PanelTitle>

      {reel.review?.thumbnailUrl ? (
        <img
          src={reel.review.thumbnailUrl}
          alt="Saved thumbnail"
          className="w-full rounded-md border border-border object-cover"
        />
      ) : (
        <div className="grid aspect-video w-full place-items-center gap-2 rounded-md border border-border bg-black/45 text-xs font-semibold text-muted-foreground/80">
          <ImageIcon size={24} />
          No thumbnail uploaded yet
        </div>
      )}

      {draft ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-warning/50 bg-warning/10 px-2.5 py-2 text-xs text-warning">
          <span className="font-medium">Staged local draft waiting</span>
          <span className="text-warning/80">upload or discard it in the studio</span>
        </div>
      ) : null}

      <Link
        to="/studio/$id/thumbnail"
        params={{ id: reelKey }}
        className={cn(buttonClassName("default"), "no-underline")}
      >
        <ImageIcon size={15} /> Open Thumbnail Studio
      </Link>
      <p className="text-[11px] text-muted-foreground/80">
        Frame grabs, scene stills, text overlay, aspect ratio, and AI generation all live in the
        dedicated Thumbnail Studio. Drafts stay local until uploaded to S3 or discarded.
        For Shorts, prefer 9:16 — the swipe feed still uses a video frame, not this image.
      </p>
    </div>
  );
}

// ---- Live caption editor ----

function normalizeHexColor(value: string | undefined, fallback: string): string {
  const match = /^#?([0-9a-fA-F]{6})$/.exec((value ?? "").trim());
  return match ? `#${match[1].toLowerCase()}` : fallback;
}

function captionPreviewWords(
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

function captionStyleFromReel(captionStyle: Reel["captionStyle"]) {
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

function CaptionEditor({
  reel,
  busy,
  run,
  requestConfirm,
}: {
  reel: Reel;
  busy: boolean;
  run: StudioRun;
  requestConfirm: (action: ConfirmAction) => void;
}) {
  const reelKey = reel._id ?? reel.id ?? "";
  const [style, setStyleState] = useState(() => captionStyleFromReel(reel.captionStyle));
  const styleDirtyRef = useRef(false);
  const setStyle = useCallback(
    (updater: typeof style | ((s: typeof style) => typeof style)) => {
      styleDirtyRef.current = true;
      setStyleState(updater);
    },
    [],
  );
  useEffect(() => {
    if (styleDirtyRef.current) return;
    setStyleState(captionStyleFromReel(reel.captionStyle));
  }, [reel.captionStyle]);
  const [fonts, setFonts] = useState<FontOption[]>([]);
  useEffect(() => {
    void listFonts()
      .then(setFonts)
      .catch(() => setFonts([]));
  }, []);
  const previewRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef(0);
  const marginVAtDragStartRef = useRef(style.marginV);
  const marginVRef = useRef(style.marginV);
  const styleRef = useRef(style);
  marginVRef.current = style.marginV;
  styleRef.current = style;
  const [previewHeight, setPreviewHeight] = useState(284);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const sync = () => setPreviewHeight(el.getBoundingClientRect().height);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Image reels use a scene still; gameplay has no stills — solid black fallback.
  const bg = reel.scenes?.find((s) => s.assetUrl)?.assetUrl;
  const set = <K extends keyof typeof style>(k: K, v: (typeof style)[K]) =>
    setStyle((s) => ({ ...s, [k]: v }));

  const onPointerMove = useCallback(
    (clientY: number) => {
      const el = previewRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const anchorY =
        clientY - rect.top - dragOffsetRef.current;
      setStyle((s) => ({
        ...s,
        marginV: marginVFromDragY(anchorY, rect.height),
      }));
    },
    [],
  );

  useEffect(() => {
    const move = (e: PointerEvent) =>
      draggingRef.current && onPointerMove(e.clientY);
    const up = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      if (marginVRef.current === marginVAtDragStartRef.current) return;
      void updateCaptions(
        reelKey,
        captionStylePayload(styleRef.current, CAPTION_STYLE_DEFAULTS),
      ).catch(() => {});
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [onPointerMove, reelKey]);

  const captionPos = captionPreviewPosition(
    style.marginV,
    style.marginL,
    style.marginR,
  );

  const previewWords = captionPreviewWords(reel, style.chunkSize, style.uppercase);
  // Karaoke fill is opt-in. Only when it's on AND a distinct highlight colour is
  // set does the highlight base appear. Mirrors KARAOKE/HAS_HIGHLIGHT in the
  // renderer's buildPortraitKaraoke.
  const hasHighlight =
    style.karaoke &&
    style.activeColor.toLowerCase() !== style.primaryColor.toLowerCase();
  const activeWordIndex = hasHighlight
    ? Math.min(1, Math.max(previewWords.length - 1, 0))
    : -1;
  const outlinePx = Math.max(1, Math.round(style.outlineWidth / 2));
  const previewFontPx = captionPreviewFontSize(style.fontSize, previewHeight);
  const wordStyle = {
    fontFamily: style.fontName,
    fontSize: `${previewFontPx}px`,
    fontWeight: style.bold ? 800 : 500,
    WebkitTextStroke: `${outlinePx}px ${style.outlineColor}`,
    paintOrder: "stroke fill" as const,
    lineHeight: 1,
    textShadow: "0 1px 4px rgba(0,0,0,0.65)",
  };

  return (
    <div className="grid gap-2.5">
      <PanelTitle className="text-foreground">Captions</PanelTitle>

      <div
        ref={previewRef}
        className="relative mx-auto aspect-9/16 w-40 select-none overflow-hidden rounded-md border border-border bg-black"
        style={
          bg
            ? {
                backgroundImage: `url(${bg})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <div
          className="absolute z-10 flex cursor-grab flex-wrap justify-center gap-x-1 active:cursor-grabbing"
          style={captionPos}
          onPointerDown={(e) => {
            draggingRef.current = true;
            marginVAtDragStartRef.current = style.marginV;
            const el = previewRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const anchorY = anchorYFromMarginV(style.marginV, rect.height);
            dragOffsetRef.current = e.clientY - rect.top - anchorY;
          }}
        >
          {previewWords.map((word, index) => (
            <span
              key={`${word}-${index}`}
              style={{
                ...wordStyle,
                color:
                  index === activeWordIndex ? style.activeColor : style.primaryColor,
                whiteSpace: "nowrap",
              }}
            >
              {word}
            </span>
          ))}
        </div>
      </div>
      <p className="text-center text-[11px] text-muted-foreground/80">
        Drag vertically to position — saved automatically
        {hasHighlight ? " · text catches up letter by letter" : null}
      </p>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Label className="gap-1 text-muted-foreground">
          Font
          <Select
            value={style.fontName}
            disabled={busy}
            onChange={(e) => set("fontName", e.target.value)}
          >
            {fonts.every((f) => f.family !== style.fontName) ? (
              <option value={style.fontName}>{style.fontName} (system)</option>
            ) : null}
            {fonts.map((f) => (
              <option key={f.id} value={f.family}>
                {f.label}
              </option>
            ))}
          </Select>
        </Label>
        <Label className="gap-1 text-muted-foreground">
          Size
          <Input
            type="number"
            value={style.fontSize}
            disabled={busy}
            onChange={(e) => set("fontSize", Number(e.target.value) || 0)}
          />
        </Label>
        <Label className="gap-1 text-muted-foreground">
          Words/chunk
          <Input
            type="number"
            min={1}
            max={12}
            value={style.chunkSize}
            disabled={busy}
            onChange={(e) =>
              set("chunkSize", Math.max(1, Number(e.target.value) || 1))
            }
          />
        </Label>
        <Label className="gap-1 text-muted-foreground">
          Text color
          <input
            type="color"
            className="h-8 w-full rounded border border-border bg-card"
            value={style.primaryColor}
            disabled={busy}
            onChange={(e) =>
              set("primaryColor", normalizeHexColor(e.target.value, style.primaryColor))
            }
          />
        </Label>
        <Label className="gap-1 text-muted-foreground">
          Highlight color
          <span className="text-[10px] font-normal text-muted-foreground/80">
            {!style.karaoke
              ? "Enable letter-by-letter fill to use"
              : hasHighlight
                ? "Word starts here; text catches up"
                : "Match text colour = no highlight"}
          </span>
          <input
            type="color"
            className="h-8 w-full rounded border border-border bg-card"
            value={style.activeColor}
            disabled={busy}
            onChange={(e) =>
              set("activeColor", normalizeHexColor(e.target.value, style.activeColor))
            }
          />
        </Label>
        <Label className="gap-1 text-muted-foreground">
          Outline color
          <input
            type="color"
            className="h-8 w-full rounded border border-border bg-card"
            value={style.outlineColor}
            disabled={busy}
            onChange={(e) =>
              set("outlineColor", normalizeHexColor(e.target.value, style.outlineColor))
            }
          />
        </Label>
        <Label className="gap-1 text-muted-foreground">
          Outline width
          <Input
            type="number"
            min={0}
            max={20}
            value={style.outlineWidth}
            disabled={busy}
            onChange={(e) => set("outlineWidth", Number(e.target.value) || 0)}
          />
        </Label>
      </div>

      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <input
          type="checkbox"
          checked={style.uppercase}
          disabled={busy}
          onChange={(e) => set("uppercase", e.target.checked)}
        />
        ALL CAPS
      </label>

      <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <input
          type="checkbox"
          checked={style.karaoke}
          disabled={busy}
          onChange={(e) => set("karaoke", e.target.checked)}
        />
        Letter-by-letter fill
        <span className="font-normal text-muted-foreground/80">
          (word starts in highlight, text catches up)
        </span>
      </label>

      <Button
        type="button"
        variant="default"
        disabled={busy}
        onClick={() => {
          const burnStyle = captionStylePayload(style, CAPTION_STYLE_DEFAULTS);
          if (!reel.outputUrl) {
            void run(async () => {
              await updateCaptions(reelKey, burnStyle);
              styleDirtyRef.current = false;
              return getReel(reelKey);
            });
            return;
          }
          const costsCredits = gameplayRerenderCostsCredits(reel);
          requestConfirm({
            title: costsCredits
              ? "Apply captions & re-render (TTS)?"
              : "Apply captions & re-render?",
            body: costsCredits
              ? "Gameplay caption apply re-runs OpenRouter TTS for the full reel, then rebuilds captions."
              : "Re-burns captions onto the existing video. Scene images and narration are reused.",
            details: costsCredits
              ? [
                  "OpenRouter narration credits will be charged.",
                  "Spend is added to this reel's cost breakdown when the job finishes.",
                ]
              : ["No OpenRouter image/TTS spend for image reels when assets already exist."],
            confirmLabel: costsCredits ? "Spend credits & apply" : "Apply & re-render",
            onConfirm: () =>
              run(async () => {
                const next = await applyCaptions(reelKey, burnStyle);
                styleDirtyRef.current = false;
                return next;
              }, { requireFfmpeg: true }),
          });
        }}
      >
        <RefreshCw size={15} />{" "}
        {reel.outputUrl
          ? reel.strategy === "gameplay_overlay"
            ? "Apply captions & re-render (re-TTS)"
            : "Apply captions & re-render"
          : "Apply captions"}
      </Button>
    </div>
  );
}
