import { getRouteApi, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Captions,
  CheckCircle2,
  Clapperboard,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  Loader2,
  Palette,
  Play,
  RefreshCw,
  Scissors,
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
  discardEditDraft,
  saveEditDraft,
  updateCaptions,
  applyCaptions,
  updateReelSettings,
  updateScene,
  type ArtStyleOption,
  type CaptionStyle,
  type EditEffects,
  type FontOption,
  type ImageModelOption,
  type OutroSettings,
  type Reel,
  type Scene,
  type TtsVoiceOption,
  type YouTubeChannelOption,
} from "@/api/reels";
import { listHorrorReferences, type HorrorReference } from "@/api/trends";
import { EditEffectsControls } from "@/components/reels/EditEffectsControls";
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

const route = getRouteApi("/studio/$id");

const ACTIVE: Reel["status"][] = [
  "pending",
  "planning",
  "generating_assets",
  "generating_audio",
  "aligning",
  "rendering",
  "uploading",
];

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
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("source");

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

  // Poll while the reel is actively generating.
  useEffect(() => {
    if (!reel || !ACTIVE.includes(reel.status)) return;
    const t = setInterval(() => void refresh(), 2500);
    return () => clearInterval(t);
  }, [reel, refresh]);

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
  const run = useCallback(async (action: () => Promise<Reel>) => {
    setBusy(true);
    setError(undefined);
    try {
      setReel(await action());
    } catch (err) {
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

  const isGenerating = ACTIVE.includes(reel.status);
  const scenes = reel.scenes ?? [];
  const hasDraft = Boolean(reel.editDraft);
  // A look/voice change (art, image model, narration voice, voice FX) clears the
  // affected assets so the next produce regenerates them — deferred by design, so
  // it's easy to miss. Surface it on an already-produced reel with a one-click apply.
  const clearedImages = scenes.some((s) => !s.assetUrl && !s.isHero);
  const clearedAudio = scenes.some((s) => !s.audioUrl);
  const pendingRegen =
    !isGenerating &&
    !hasDraft &&
    Boolean(reel.outputUrl) &&
    scenes.length > 0 &&
    (clearedImages || clearedAudio);
  const basePreviewUrl = mediaUrl(reel.editDraft?.outputUrl) ?? reel.outputUrl;
  const previewUrl = basePreviewUrl
    ? `${basePreviewUrl}${basePreviewUrl.includes("?") ? "&" : "?"}v=${encodeURIComponent(reel.outputUrl ?? reel.editDraft?.id ?? reel.updatedAt ?? String(reel.progress))}`
    : undefined;
  const selectedScene = scenes[selectedSceneIndex] ?? scenes[0];

  return (
    <section className="studio-workspace w-full min-w-0 overflow-x-clip bg-[#101216] px-3 pb-5 text-slate-100 sm:px-4 lg:px-5">
      <header className="sticky top-0 z-20 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-b-lg border border-t-0 border-slate-800 bg-[#171a20]/95 px-3 py-2 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            search={{ status: undefined }}
            className="grid size-9 place-items-center rounded-md border border-slate-700 bg-[#20242c] text-slate-300 hover:bg-[#2a303a] hover:text-white"
            title="Back to reels"
          >
            <ArrowLeft size={17} />
          </Link>
          <div className="min-w-0">
            <h1 className="m-0 flex min-w-0 items-center gap-2 truncate text-base tracking-normal text-white">
              <Clapperboard size={18} className="text-cyan-300" />
              <span className="truncate">{reel.title || "Untitled reel"}</span>
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">
              {reel.niche} · {reel.genre ?? "no genre"} ·{" "}
              <ReelStatusChip status={reel.status} className="min-w-[82px]" /> · {reel.progress}%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasDraft ? (
            <span className="rounded-full border border-amber-400/50 bg-amber-400/10 px-2.5 py-1 text-xs font-bold text-amber-200">
              Unsaved draft
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => void refresh()}
            disabled={busy}
            className="border-slate-700 bg-[#20242c] text-slate-100 hover:bg-[#2a303a]"
          >
            <RefreshCw
              size={15}
              className={isGenerating ? "animate-spin" : undefined}
            />
            Refresh
          </Button>
        </div>
      </header>

      {error ? (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <EditDraftBanner reel={reel} busy={busy} run={run} />

      <GateBanner
        reel={reel}
        busy={busy}
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
            ],
            confirmLabel: "Generate",
            onConfirm: () => run(() => approvePlan(id)),
          })
        }
      />

      {pendingRegen ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
          <div className="min-w-0">
            <div className="font-semibold text-amber-200">
              Settings changed — re-render to apply
            </div>
            <div className="text-xs text-amber-100/80">
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
            disabled={busy}
            onClick={() => void run(() => regenerateReel(id, "render_only"))}
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
        <aside className="grid min-h-0 min-w-0 gap-3 xl:sticky xl:top-[71px] xl:max-h-[calc(100vh-83px)]">
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
          <ProgramMonitor reel={reel} previewUrl={previewUrl} />
          <TimelinePanel
            reel={reel}
            scenes={scenes}
            selectedSceneIndex={selectedSceneIndex}
            onSelectScene={setSelectedSceneIndex}
            busy={busy}
            disabled={isGenerating}
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
              busy={busy}
              disabled={isGenerating}
              run={run}
              requestConfirm={setConfirmAction}
            />
          ) : (
            <div className="grid place-items-center rounded-lg border border-slate-800 bg-[#171a20] p-8 text-sm text-slate-400">
              No scenes yet.
            </div>
          )}
        </main>

        <div className="grid min-h-0 min-w-0 gap-3 xl:sticky xl:top-[71px] xl:max-h-[calc(100vh-83px)] xl:overflow-y-auto xl:pr-1">
          <InspectorPanel
            tab={inspectorTab}
            onTabChange={setInspectorTab}
            reel={reel}
            busy={busy}
            run={run}
            requestConfirm={setConfirmAction}
          />
          <VoiceVariantsPanel reel={reel} reelId={id} onRefresh={refresh} />
        </div>
      </div>
      <ConfirmModal
        action={confirmAction}
        busy={busy}
        onClose={() => setConfirmAction(undefined)}
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
    <section
      className={cn(
        "min-w-0 rounded-lg border border-slate-800 bg-[#171a20] shadow-[0_18px_50px_rgba(0,0,0,0.18)]",
        className,
      )}
    >
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-slate-800 px-3 py-2">
        <strong className="inline-flex min-w-0 items-center gap-2 text-[13px] uppercase tracking-[0.08em] text-slate-300">
          {icon}
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
      className="overflow-hidden xl:max-h-[calc(100vh-83px)]"
    >
      <div className="grid min-w-0 gap-3 overflow-x-hidden p-3 xl:max-h-[calc(100vh-138px)] xl:overflow-y-auto">
        <ReelContextBar
          reel={reel}
          seriesReels={seriesReels}
          currentId={currentId}
        />
        <div className="grid gap-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold text-slate-200">Scene bin</span>
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
                    ? "border-cyan-400/70 bg-cyan-400/10"
                    : "border-slate-800 bg-[#111419] hover:border-slate-600 hover:bg-[#1d222b]",
                )}
              >
                <SceneThumb reel={reel} scene={scene} className="w-[42px]" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold text-slate-100">
                    {String(scene.index + 1).padStart(2, "0")} ·{" "}
                    {scene.narration || "Untitled beat"}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">
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
}: {
  reel: Reel;
  previewUrl?: string;
}) {
  return (
    <EditorPanel
      title={
        reel.editDraft ? "Program monitor · local draft" : "Program monitor"
      }
      icon={<Play size={15} />}
      actions={
        <span className="rounded-full border border-slate-700 bg-[#101216] px-2 py-1 text-[11px] font-bold text-slate-400">
          9:16
        </span>
      }
      className="overflow-hidden"
    >
      <div className="grid place-items-center bg-[#0b0d10] p-3">
        {previewUrl ? (
          <div className="relative grid w-full max-w-[360px] place-items-center">
            <div className="absolute -inset-3 rounded-[18px] bg-cyan-400/5 blur-xl" />
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              key={previewUrl}
              src={previewUrl}
              controls
              className="relative aspect-9/16 max-h-[50vh] w-full rounded-lg border border-slate-800 bg-black shadow-[0_24px_90px_rgba(0,0,0,0.45)] xl:max-h-[46vh]"
            />
          </div>
        ) : (
          <div className="grid aspect-9/16 max-h-[50vh] w-full max-w-[360px] place-items-center rounded-lg border border-slate-800 bg-black text-sm text-slate-500 xl:max-h-[46vh]">
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
        "grid aspect-9/16 place-items-center overflow-hidden rounded border border-slate-700 bg-[#0b0d10] text-slate-500",
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
  reel,
  scenes,
  selectedSceneIndex,
  onSelectScene,
  busy,
  disabled,
  onAddScene,
}: {
  reel: Reel;
  scenes: Scene[];
  selectedSceneIndex: number;
  onSelectScene: (index: number) => void;
  busy: boolean;
  disabled: boolean;
  onAddScene: () => void;
}) {
  return (
    <EditorPanel
      title="Timeline"
      icon={<Scissors size={15} />}
      actions={
        <Button
          type="button"
          variant="outline"
          size="default"
          disabled={busy || disabled}
          onClick={onAddScene}
          className="min-h-8 border-slate-700 bg-[#20242c] px-2 py-1 text-xs text-slate-100 hover:bg-[#2a303a]"
        >
          + Add scene
        </Button>
      }
    >
      <div className="grid min-w-0 gap-2 p-3">
        <div className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)] items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
            Video
          </span>
          <div className="min-w-0 overflow-x-auto pb-1">
            <div className="flex w-max gap-1.5">
              {scenes.map((scene) => (
                <button
                  key={scene.index}
                  type="button"
                  onClick={() => onSelectScene(scene.index)}
                  className={cn(
                    "relative grid min-w-[132px] grid-cols-[34px_1fr] items-center gap-2 rounded-md border px-2 py-1.5 text-left",
                    selectedSceneIndex === scene.index
                      ? "border-cyan-400 bg-cyan-400/10"
                      : "border-slate-800 bg-[#111419] hover:border-slate-600",
                  )}
                >
                  <SceneThumb reel={reel} scene={scene} className="w-[34px]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-bold text-slate-200">
                      Scene {scene.index + 1}
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      {Math.max(scene.duration || 0, 0).toFixed(1)}s
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)] items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
            Audio
          </span>
          <div className="min-w-0 overflow-x-auto pb-1">
            <div className="flex w-max gap-1.5">
              {scenes.map((scene) => (
                <button
                  key={scene.index}
                  type="button"
                  onClick={() => onSelectScene(scene.index)}
                  className={cn(
                    "flex min-w-[132px] items-center gap-2 rounded-md border px-2 py-2 text-left",
                    selectedSceneIndex === scene.index
                      ? "border-emerald-400/70 bg-emerald-400/10"
                      : "border-slate-800 bg-[#111419] hover:border-slate-600",
                  )}
                >
                  <Volume2 size={14} className="text-emerald-300" />
                  <span className="truncate text-[11px] font-bold text-slate-300">
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
  run,
  requestConfirm,
}: {
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  reel: Reel;
  busy: boolean;
  run: (a: () => Promise<Reel>) => Promise<void>;
  requestConfirm: (action: ConfirmAction) => void;
}) {
  return (
    <EditorPanel
      title="Inspector"
      icon={<Settings2 size={15} />}
      className="overflow-hidden xl:max-h-[calc(100vh-83px)]"
    >
      <div className="border-b border-slate-800 bg-[#111419]">
        <div className="studio-scrollbar flex min-w-0 gap-1 overflow-x-auto overscroll-x-contain p-2">
          {INSPECTOR_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={cn(
                "inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-bold transition-colors",
                item.id === "thumbnail" ? "min-w-[92px]" : "min-w-[86px]",
                tab === item.id
                  ? "bg-cyan-400 text-slate-950"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0 overflow-x-hidden p-3 xl:max-h-[calc(100vh-174px)] xl:overflow-y-auto">
        {tab === "source" ? (
          <StoryPanel reel={reel} busy={busy} run={run} />
        ) : null}
        {tab === "look" ? (
          <PresetsPanel
            reel={reel}
            busy={busy}
            run={run}
            requestConfirm={requestConfirm}
          />
        ) : null}
        {tab === "effects" ? (
          <EffectsPanel reel={reel} busy={busy} run={run} />
        ) : null}
        {tab === "outro" ? (
          <OutroPanel reel={reel} busy={busy} run={run} />
        ) : null}
        {tab === "thumbnail" ? (
          <ThumbnailPanel reel={reel} />
        ) : null}
        {tab === "captions" ? (
          <CaptionEditor reel={reel} busy={busy} run={run} />
        ) : null}
        {tab === "export" ? (
          <RegeneratePanel
            reel={reel}
            busy={busy}
            run={run}
            requestConfirm={requestConfirm}
          />
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
  run: (a: () => Promise<Reel>) => Promise<void>;
}) {
  if (!reel.editDraft) return null;
  const reelKey = reel._id ?? reel.id ?? "";
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
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
      <div className="grid w-full max-w-md gap-3 rounded-lg border border-slate-700 bg-[#171a20] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <strong className="text-base text-white">{action.title}</strong>
            <p className="m-0 text-sm leading-relaxed text-slate-400">
              {action.body}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={busy}
            onClick={onClose}
            className="text-slate-300 hover:bg-slate-800"
          >
            <X size={16} />
          </Button>
        </div>
        {action.details?.length ? (
          <div className="grid gap-1 rounded-md border border-slate-800 bg-[#111419] p-2.5 text-xs text-slate-400">
            {action.details.map((detail) => (
              <div key={detail} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
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
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-800 bg-[#111419] px-3 py-2 text-xs">
        <span className="font-extrabold text-slate-100">Standalone reel</span>
        <span className="text-slate-500">
          Scenes, voice, captions, and render settings apply only to this reel.
        </span>
      </div>
    );
  }

  const parts = seriesReels.length ? seriesReels : [reel];
  return (
    <div className="grid gap-2 rounded-md border border-slate-800 bg-[#111419] px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs">
          <span className="font-extrabold text-slate-100">Series</span>
          <span className="ml-2 text-slate-500">
            Part {reel.partNumber ?? 1} of {reel.partCount ?? parts.length}
          </span>
        </div>
        <span className="text-[11px] font-bold text-slate-500">
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
                  ? "border-cyan-400/70 bg-cyan-400/10"
                  : "border-slate-800 bg-[#171a20] hover:bg-[#20242c]",
              )}
            >
              <span className="font-extrabold text-slate-100">
                Part {part.partNumber ?? 1}
              </span>
              <span className="truncate text-slate-500">
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
        <span className="font-bold text-slate-100">
          {reel.partCount && reel.partCount > 1
            ? `Part ${reel.partNumber ?? 1} plan ready — review & edit this episode below.`
            : "Plan ready — review & edit the script, art, voice, and captions below."}
        </span>
        <span className="text-slate-400">
          No images/voice have been generated yet (no spend).
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

function StoryPanel({
  reel,
  busy,
  run,
}: {
  reel: Reel;
  busy: boolean;
  run: (a: () => Promise<Reel>) => Promise<void>;
}) {
  const [script, setScript] = useState(reel.providedScript ?? "");
  const [references, setReferences] = useState<HorrorReference[]>([]);
  const bible = reel.storyBible;

  useEffect(() => {
    void listHorrorReferences(12)
      .then(setReferences)
      .catch(() => setReferences([]));
  }, []);

  return (
    <div className="grid gap-3 rounded-md border border-slate-800 bg-[#111419] p-3">
      <PanelTitle className="text-slate-100">Story source</PanelTitle>

      {reel.horrorReference ? (
        <div className="rounded-md border border-slate-800 bg-[#171a20] p-2.5 text-xs">
          <div className="font-bold text-slate-100">Reference used</div>
          <a
            href={reel.horrorReference.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary"
          >
            {reel.horrorReference.title} <ExternalLink size={12} />
          </a>
          <span className="ml-1 text-slate-500">
            {reel.horrorReference.author
              ? `· ${reel.horrorReference.author}`
              : ""}{" "}
            {reel.horrorReference.license ?? ""}
          </span>
        </div>
      ) : null}

      {bible ? (
        <div className="grid gap-1 rounded-md border border-slate-800 bg-[#171a20] p-2.5 text-xs">
          <div className="font-bold text-slate-100">{bible.premise}</div>
          <div className="text-slate-500">
            Anchor: {bible.anchorObject} · Rule: {bible.impossibleRule}
          </div>
          <div className="text-slate-500">Twist: {bible.finalTwist}</div>
        </div>
      ) : null}

      <Label className="text-slate-300">
        Pick a scraped reference (optional)
        <Select
          disabled={busy}
          value={reel.horrorReferenceId ?? ""}
          onChange={(e) =>
            void run(() =>
              replanReel(reel._id ?? reel.id ?? "", {
                horrorReferenceId: e.target.value,
              }),
            )
          }
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

      <Label className="text-slate-300">
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
        className="border-slate-700 bg-[#20242c] text-slate-100 hover:bg-[#2a303a]"
        disabled={busy || !script.trim()}
        onClick={() =>
          void run(() =>
            replanReel(reel._id ?? reel.id ?? "", {
              providedScript: script.trim(),
            }),
          )
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
  run,
  requestConfirm,
}: {
  reelId: string;
  reel: Reel;
  scene: Scene;
  total: number;
  busy: boolean;
  disabled: boolean;
  run: (a: () => Promise<Reel>) => Promise<void>;
  requestConfirm: (action: ConfirmAction) => void;
}) {
  const [narration, setNarration] = useState(scene.narration);
  const [visualPrompt, setVisualPrompt] = useState(scene.visualPrompt);
  const dirty =
    narration !== scene.narration || visualPrompt !== scene.visualPrompt;

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
    <div className="grid min-w-0 gap-3 rounded-lg border border-slate-800 bg-[#171a20] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.18)] md:grid-cols-[120px_minmax(0,1fr)]">
      <div className="grid gap-1.5">
        <div className="grid aspect-9/16 w-full place-items-center overflow-hidden rounded-md border border-slate-700 bg-[#0b0d10] text-slate-500">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`Scene ${scene.index + 1}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageIcon size={20} />
          )}
        </div>
        <span className="text-center text-[11px] font-bold text-slate-500">
          Scene {scene.index + 1}/{total}
        </span>
        {audioUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio src={audioUrl} controls className="h-7 w-full" />
        ) : (
          <span className="inline-flex items-center justify-center gap-1 text-[11px] text-slate-500">
            <Play size={11} /> no audio
          </span>
        )}
      </div>

      <div className="grid min-w-0 gap-2 overflow-hidden">
        <Label className="gap-1 text-xs text-slate-300">
          Narration
          <Textarea
            rows={3}
            value={narration}
            disabled={disableAll}
            onChange={(e) => setNarration(e.target.value)}
          />
        </Label>
        <Label className="gap-1 text-xs text-slate-300">
          Visual prompt
          <Textarea
            rows={2}
            value={visualPrompt}
            disabled={disableAll}
            onChange={(e) => setVisualPrompt(e.target.value)}
          />
        </Label>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
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
          <Button
            type="button"
            size="default"
            variant={dirty ? "default" : "outline"}
            disabled={disableAll || !dirty}
            onClick={() =>
              void run(() =>
                updateScene(reelId, scene.index, { narration, visualPrompt }),
              )
            }
          >
            {dirty ? "Save" : "Saved"}
          </Button>
          <Button
            type="button"
            size="default"
            variant="outline"
            className="border-slate-700 bg-[#20242c] text-slate-100 hover:bg-[#2a303a]"
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
            className="border-slate-700 bg-[#20242c] text-slate-100 hover:bg-[#2a303a]"
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
          {total > 1 ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="text-red-300 hover:bg-red-400/10 hover:text-red-200"
              disabled={disableAll}
              onClick={() =>
                requestConfirm({
                  title: `Remove scene ${scene.index + 1}?`,
                  body: "This removes the scene from the reel plan. It does not call OpenRouter by itself.",
                  confirmLabel: "Remove scene",
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
  run: (a: () => Promise<Reel>) => Promise<void>;
  requestConfirm: (action: ConfirmAction) => void;
}) {
  const [artStyles, setArtStyles] = useState<ArtStyleOption[]>([]);
  const [imageModels, setImageModels] = useState<ImageModelOption[]>([]);
  const [voices, setVoices] = useState<TtsVoiceOption[]>([]);
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
  }, []);

  const currentVoice =
    reel.voiceOverride?.voice ?? reel.narrationVoice?.voice ?? "";

  return (
    <div className="grid gap-2.5 rounded-md border border-slate-800 bg-[#111419] p-3">
      <PanelTitle className="text-slate-100">Look & Voice</PanelTitle>

      <Label className="text-xs text-slate-300">
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

      <Label className="text-xs text-slate-300">
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

      <Label className="text-xs text-slate-300">
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

      <Label className="text-xs text-slate-300">
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

      <Label className="text-xs text-slate-300">
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
      <p className="text-[11px] text-slate-500">
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
  run: (a: () => Promise<Reel>) => Promise<void>;
  requestConfirm: (action: ConfirmAction) => void;
}) {
  const reelKey = reel._id ?? reel.id ?? "";
  const canRegen = reel.status === "completed" || reel.status === "failed";
  if (!canRegen) return null;
  return (
    <div className="grid gap-2 rounded-md border border-slate-800 bg-[#111419] p-3">
      <PanelTitle className="text-slate-100">Render Queue</PanelTitle>
      <Button
        type="button"
        variant="outline"
        className="border-slate-700 bg-[#20242c] text-slate-100 hover:bg-[#2a303a]"
        disabled={busy}
        onClick={() => void run(() => regenerateReel(reelKey, "render_only"))}
      >
        <RefreshCw size={15} /> Re-render (reuse assets — free)
      </Button>
      <Button
        type="button"
        variant="outline"
        className="border-red-400/40 bg-red-400/10 text-red-200 hover:bg-red-400/15"
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
              "Use re-render instead for caption, edit FX, outro, or layout-only changes.",
            ],
            confirmLabel: "Regenerate all assets",
            variant: "destructive",
            onConfirm: () => run(() => regenerateReel(reelKey, "assets")),
          })
        }
      >
        <Wand2 size={15} /> Regenerate all assets ($)
      </Button>
    </div>
  );
}

// ---- Cinematic edit effects (rain / grain / vignette / letterbox) ----

function EffectsPanel({
  reel,
  busy,
  run,
}: {
  reel: Reel;
  busy: boolean;
  run: (a: () => Promise<Reel>) => Promise<void>;
}) {
  const reelKey = reel._id ?? reel.id ?? "";
  const [fx, setFx] = useState<EditEffects>(reel.editEffects ?? {});
  useEffect(() => setFx(reel.editEffects ?? {}), [reel.editEffects]);

  return (
    <div className="grid gap-2.5 rounded-md border border-slate-800 bg-[#111419] p-3">
      <PanelTitle className="text-slate-100">Edit Effects</PanelTitle>
      <EditEffectsControls value={fx} onChange={setFx} disabled={busy} />
      <Button
        type="button"
        variant="default"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            await updateReelSettings(reelKey, { editEffects: fx });
            return regenerateReel(reelKey, "render_only");
          })
        }
      >
        <RefreshCw size={15} /> Apply &amp; re-render (free)
      </Button>
      <p className="text-[11px] text-slate-500">
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
}: {
  reel: Reel;
  busy: boolean;
  run: (a: () => Promise<Reel>) => Promise<void>;
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
    <div className="grid gap-2.5 rounded-md border border-slate-800 bg-[#111419] p-3">
      <PanelTitle className="text-slate-100">Outro</PanelTitle>

      <Label className="text-xs text-slate-300">
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
        <div className="rounded-md border border-slate-800 bg-[#171a20] px-3 py-2 text-xs text-slate-400">
          The outro will use {channelDisplayName(selected)} unless you override the display name below.
        </div>
      ) : null}

      <Label className="text-xs text-slate-300">
        Display name override
        <Input
          disabled={busy}
          value={outro.channelName ?? ""}
          placeholder={selected ? channelDisplayName(selected) : "Auto channel name"}
          onChange={(event) => patchOutro({ channelName: event.target.value })}
        />
      </Label>

      <Label className="text-xs text-slate-300">
        Handle override
        <Input
          disabled={busy}
          value={outro.channelHandle ?? ""}
          placeholder="@channel"
          onChange={(event) => patchOutro({ channelHandle: event.target.value })}
        />
      </Label>

      <Label className="text-xs text-slate-300">
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
        <Label className="text-xs text-slate-300">
          Card title
          <Input
            disabled={busy}
            value={outro.title ?? ""}
            placeholder={reel.niche.startsWith("horror") ? "DON'T WATCH ALONE" : "FOLLOW FOR MORE"}
            onChange={(event) => patchOutro({ title: event.target.value })}
          />
        </Label>
        <Label className="text-xs text-slate-300">
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
        <Label className="text-xs text-slate-300">
          CTA button
          <Input
            disabled={busy}
            value={outro.cta ?? ""}
            placeholder="SUBSCRIBE"
            onChange={(event) => patchOutro({ cta: event.target.value })}
          />
        </Label>
        <Label className="text-xs text-slate-300">
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
          void run(async () => {
            await updateReelSettings(reelKey, {
              outroChannelId,
              outro: compactOutroSettings(outro),
            });
            return regenerateReel(reelKey, "render_only");
          })
        }
      >
        <RefreshCw size={15} /> Render outro draft
      </Button>
      <p className="text-[11px] text-slate-500">
        Reuses all scene stills and narration. Only the outro narration, outro card, and preview video are rebuilt.
      </p>
    </div>
  );
}

function ThumbnailPanel({ reel }: { reel: Reel }) {
  const reelKey = reel._id ?? reel.id ?? "";
  const draft = reel.thumbnailDraft;
  return (
    <div className="grid gap-2.5 rounded-md border border-slate-800 bg-[#111419] p-3">
      <PanelTitle className="text-slate-100">Thumbnail</PanelTitle>

      {reel.review?.thumbnailUrl ? (
        <img
          src={reel.review.thumbnailUrl}
          alt="Saved thumbnail"
          className="w-full rounded-md border border-slate-700 object-cover"
        />
      ) : (
        <div className="grid aspect-video w-full place-items-center gap-2 rounded-md border border-slate-800 bg-[#0b0d10] text-xs font-semibold text-slate-500">
          <ImageIcon size={24} />
          No thumbnail uploaded yet
        </div>
      )}

      {draft ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-amber-400/50 bg-amber-400/10 px-2.5 py-2 text-xs text-amber-200">
          <span className="font-bold">Staged local draft waiting</span>
          <span className="text-amber-100/80">upload or discard it in the studio</span>
        </div>
      ) : null}

      <Link
        to="/studio/$id/thumbnail"
        params={{ id: reelKey }}
        className={cn(buttonClassName("default"), "no-underline")}
      >
        <ImageIcon size={15} /> Open Thumbnail Studio
      </Link>
      <p className="text-[11px] text-slate-500">
        Frame grabs, scene stills, text overlay, aspect ratio, and AI generation all live in the
        dedicated Thumbnail Studio. Drafts stay local until uploaded to S3 or discarded.
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
}: {
  reel: Reel;
  busy: boolean;
  run: (a: () => Promise<Reel>) => Promise<void>;
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
    <div className="grid gap-2.5 rounded-md border border-slate-800 bg-[#111419] p-3">
      <PanelTitle className="text-slate-100">Captions</PanelTitle>

      <div
        ref={previewRef}
        className="relative mx-auto aspect-9/16 w-40 select-none overflow-hidden rounded-md border border-slate-700 bg-black"
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
      <p className="text-center text-[11px] text-slate-500">
        Drag vertically to position — saved automatically
        {hasHighlight ? " · text catches up letter by letter" : null}
      </p>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Label className="gap-1 text-slate-300">
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
        <Label className="gap-1 text-slate-300">
          Size
          <Input
            type="number"
            value={style.fontSize}
            disabled={busy}
            onChange={(e) => set("fontSize", Number(e.target.value) || 0)}
          />
        </Label>
        <Label className="gap-1 text-slate-300">
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
        <Label className="gap-1 text-slate-300">
          Text color
          <input
            type="color"
            className="h-8 w-full rounded border border-slate-700 bg-[#171a20]"
            value={style.primaryColor}
            disabled={busy}
            onChange={(e) =>
              set("primaryColor", normalizeHexColor(e.target.value, style.primaryColor))
            }
          />
        </Label>
        <Label className="gap-1 text-slate-300">
          Highlight color
          <span className="text-[10px] font-normal text-slate-500">
            {!style.karaoke
              ? "Enable letter-by-letter fill to use"
              : hasHighlight
                ? "Word starts here; text catches up"
                : "Match text colour = no highlight"}
          </span>
          <input
            type="color"
            className="h-8 w-full rounded border border-slate-700 bg-[#171a20]"
            value={style.activeColor}
            disabled={busy}
            onChange={(e) =>
              set("activeColor", normalizeHexColor(e.target.value, style.activeColor))
            }
          />
        </Label>
        <Label className="gap-1 text-slate-300">
          Outline color
          <input
            type="color"
            className="h-8 w-full rounded border border-slate-700 bg-[#171a20]"
            value={style.outlineColor}
            disabled={busy}
            onChange={(e) =>
              set("outlineColor", normalizeHexColor(e.target.value, style.outlineColor))
            }
          />
        </Label>
        <Label className="gap-1 text-slate-300">
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

      <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
        <input
          type="checkbox"
          checked={style.uppercase}
          disabled={busy}
          onChange={(e) => set("uppercase", e.target.checked)}
        />
        ALL CAPS
      </label>

      <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
        <input
          type="checkbox"
          checked={style.karaoke}
          disabled={busy}
          onChange={(e) => set("karaoke", e.target.checked)}
        />
        Letter-by-letter fill
        <span className="font-normal text-slate-500">
          (word starts in highlight, text catches up)
        </span>
      </label>

      <Button
        type="button"
        variant="default"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const burnStyle = captionStylePayload(style, CAPTION_STYLE_DEFAULTS);
            if (!reel.outputUrl) {
              await updateCaptions(reelKey, burnStyle);
              styleDirtyRef.current = false;
              return getReel(reelKey);
            }
            const next = await applyCaptions(reelKey, burnStyle);
            styleDirtyRef.current = false;
            return next;
          })
        }
      >
        <RefreshCw size={15} /> Apply captions{reel.outputUrl ? " & re-render" : ""}
      </Button>
    </div>
  );
}
