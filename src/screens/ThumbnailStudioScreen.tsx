import { getRouteApi, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Clapperboard,
  CloudUpload,
  Grid3x3,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Type,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  discardThumbnailDraft,
  getReel,
  listFonts,
  mediaUrl,
  previewCustomFrameThumbnail,
  previewFrameThumbnail,
  regenerateThumbnail,
  saveThumbnailDraft,
  stageThumbnailDraft,
  type FontOption,
  type Reel,
  type Scene,
  type ThumbnailAspectRatio,
  type ThumbnailComposeInput,
} from "@/api/reels";
import { ReelStatusChip } from "@/components/reels/ReelStatusChip";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, type ConfirmDialogAction } from "@/components/ui/confirm-dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const route = getRouteApi("/studio/$id/thumbnail");

const ACTIVE: Reel["status"][] = [
  "pending",
  "planning",
  "generating_assets",
  "generating_audio",
  "aligning",
  "rendering",
  "uploading",
];

/** Real output pixel width per aspect — used to scale the overlay text so the
 *  canvas is WYSIWYG against the server's ffmpeg drawtext render. */
function outputSize(aspect: ThumbnailAspectRatio): { width: number; height: number } {
  if (aspect === "9:16") return { width: 1080, height: 1920 };
  if (aspect === "1:1") return { width: 1080, height: 1080 };
  return { width: 1280, height: 720 };
}

interface OverlayState {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  outlineColor: string;
  outlineWidth: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  align: "left" | "center" | "right";
  lineHeight: number;
  effect: "none" | "shadow" | "glow" | "box";
  uppercase: boolean;
}

const OVERLAY_DEFAULTS: OverlayState = {
  text: "",
  fontFamily: "",
  fontSize: 120,
  color: "#ffffff",
  outlineColor: "#000000",
  outlineWidth: 4,
  xPct: 0.5,
  yPct: 0.7,
  widthPct: 0.82,
  align: "center",
  lineHeight: 1.12,
  effect: "shadow",
  uppercase: true,
};

/** Client mirror of the server's wrapThumbnailText — same maxChars heuristic,
 *  so the live canvas breaks lines exactly where the ffmpeg render will. */
function wrapOverlayText(overlay: OverlayState, outWidth: number): string {
  const boxWidth = overlay.widthPct * outWidth;
  const maxChars = Math.max(4, Math.floor(boxWidth / (overlay.fontSize * 0.55)));
  const raw = overlay.uppercase ? overlay.text.toUpperCase() : overlay.text;
  return raw
    .split("\n")
    .flatMap((line) => {
      const words = line.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) return [""];
      const out: string[] = [];
      let current = "";
      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > maxChars && current) {
          out.push(current);
          current = word;
        } else {
          current = next;
        }
      }
      if (current) out.push(current);
      return out;
    })
    .join("\n");
}

function overlayFromDraftInput(input: Partial<ThumbnailComposeInput> | undefined): Partial<OverlayState> {
  if (!input) return {};
  const restored: Partial<OverlayState> = {};
  if (typeof input.text === "string") restored.text = input.text;
  if (typeof input.fontFamily === "string") restored.fontFamily = input.fontFamily;
  if (typeof input.fontSize === "number") restored.fontSize = input.fontSize;
  if (typeof input.color === "string") restored.color = input.color;
  if (typeof input.outlineColor === "string") restored.outlineColor = input.outlineColor;
  if (typeof input.outlineWidth === "number") restored.outlineWidth = input.outlineWidth;
  if (typeof input.xPct === "number") restored.xPct = input.xPct;
  if (typeof input.yPct === "number") restored.yPct = input.yPct;
  if (typeof input.widthPct === "number") restored.widthPct = input.widthPct;
  if (input.align) restored.align = input.align;
  if (typeof input.lineHeight === "number") restored.lineHeight = input.lineHeight;
  if (input.effect) restored.effect = input.effect;
  if (typeof input.uppercase === "boolean") restored.uppercase = input.uppercase;
  return restored;
}

export function ThumbnailStudioScreen() {
  const { id } = route.useParams();
  const [reel, setReel] = useState<Reel | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmDialogAction | undefined>();
  const [fonts, setFonts] = useState<FontOption[]>([]);

  // Composition source
  const [sourceType, setSourceType] = useState<"scene" | "frame">("scene");
  const [sceneIndex, setSceneIndex] = useState<number | undefined>();
  const [frameSeconds, setFrameSeconds] = useState(1.0);
  const [framePreviewUrl, setFramePreviewUrl] = useState<string | undefined>();
  const [grabbingFrame, setGrabbingFrame] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<ThumbnailAspectRatio>("16:9");

  // Text overlay
  const [overlay, setOverlay] = useState<OverlayState>(OVERLAY_DEFAULTS);
  const patchOverlay = useCallback((patch: Partial<OverlayState>) => {
    setOverlay((current) => ({ ...current, ...patch }));
    // Any control change invalidates the flattened server preview.
    setFlattenedPreviewUrl(undefined);
  }, []);

  // Flattened, server-rendered exact preview (data URL). When set, the canvas
  // shows it verbatim instead of the live-editable composition.
  const [flattenedPreviewUrl, setFlattenedPreviewUrl] = useState<string | undefined>();
  const [previewing, setPreviewing] = useState(false);

  const [showGuides, setShowGuides] = useState(true);
  const [aiPrompt, setAiPrompt] = useState("");
  const restoredDraftIdRef = useRef<string | undefined>(undefined);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageWidth, setStageWidth] = useState(640);

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
    if (!reel || !ACTIVE.includes(reel.status)) return;
    const t = setInterval(() => void refresh(), 4000);
    return () => clearInterval(t);
  }, [reel, refresh]);

  useEffect(() => {
    void listFonts()
      .then((list) => {
        setFonts(list);
        setOverlay((current) =>
          current.fontFamily ? current : { ...current, fontFamily: list[0]?.family ?? "" }
        );
      })
      .catch(() => setFonts([]));
  }, []);

  // Restore the studio controls from a staged draft exactly once per draft.
  useEffect(() => {
    const draft = reel?.thumbnailDraft;
    if (!draft || restoredDraftIdRef.current === draft.id) return;
    restoredDraftIdRef.current = draft.id;
    const input = draft.input;
    setOverlay((current) => ({ ...current, ...overlayFromDraftInput(input) }));
    if (draft.aspectRatio) setAspectRatio(draft.aspectRatio);
    if (input?.sourceType === "frame" || input?.sourceType === "scene") setSourceType(input.sourceType);
    if (typeof input?.sceneIndex === "number") setSceneIndex(input.sceneIndex);
    if (typeof input?.atSeconds === "number") setFrameSeconds(input.atSeconds);
  }, [reel?.thumbnailDraft]);

  useEffect(() => {
    if (!reel?.review?.thumbnailPrompt) return;
    setAiPrompt((current) => current || reel.review?.thumbnailPrompt || "");
  }, [reel?.review?.thumbnailPrompt]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const sync = () => setStageWidth(el.getBoundingClientRect().width || 640);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scenes = reel?.scenes ?? [];
  const sceneStills = useMemo(
    () =>
      scenes
        .map((scene) => {
          const draftAsset = reel?.editDraft?.sceneAssets.find((item) => item.index === scene.index);
          const url = mediaUrl(draftAsset?.assetUrl) ?? scene.assetUrl;
          return url ? { scene, url } : undefined;
        })
        .filter((item): item is { scene: Scene; url: string } => Boolean(item)),
    [reel?.editDraft?.sceneAssets, scenes]
  );

  useEffect(() => {
    if (sceneIndex === undefined && sceneStills.length > 0) {
      setSceneIndex(sceneStills[0].scene.index);
    }
  }, [sceneIndex, sceneStills]);

  const videoDuration = useMemo(() => {
    if (!scenes.length) return 0;
    return Math.max(...scenes.map((scene) => (scene.startTime || 0) + (scene.duration || 0)), 0);
  }, [scenes]);

  const selectedSceneUrl = sceneStills.find((item) => item.scene.index === sceneIndex)?.url;
  const sourceImageUrl = sourceType === "scene" ? selectedSceneUrl : framePreviewUrl;
  const sourceReady =
    sourceType === "scene" ? Boolean(selectedSceneUrl) : Boolean(framePreviewUrl || reel?.outputUrl);

  const composeInput = useCallback(
    (): ThumbnailComposeInput => ({
      atSeconds: Math.max(frameSeconds, 0),
      sourceType,
      sceneIndex,
      aspectRatio,
      text: overlay.text.trim() ? overlay.text : undefined,
      xPct: overlay.xPct,
      yPct: overlay.yPct,
      widthPct: overlay.widthPct,
      align: overlay.align,
      lineHeight: overlay.lineHeight,
      effect: overlay.effect,
      fontFamily: overlay.fontFamily || undefined,
      fontSize: overlay.fontSize,
      color: overlay.color,
      outlineColor: overlay.outlineColor,
      outlineWidth: overlay.outlineWidth,
      uppercase: overlay.uppercase,
    }),
    [aspectRatio, frameSeconds, overlay, sceneIndex, sourceType]
  );

  // Run a mutation, put the returned reel in state, surface failures.
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

  const grabFrame = useCallback(async () => {
    setGrabbingFrame(true);
    setError(undefined);
    try {
      const result = await previewFrameThumbnail(id, Math.max(frameSeconds, 0), aspectRatio);
      setFramePreviewUrl(result.imageDataUrl);
      setFlattenedPreviewUrl(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Frame grab failed");
    } finally {
      setGrabbingFrame(false);
    }
  }, [aspectRatio, frameSeconds, id]);

  const previewExact = useCallback(async () => {
    setPreviewing(true);
    setError(undefined);
    try {
      const input = composeInput();
      // With text the custom-compose preview is the exact final render; without
      // it, a plain frame grab is (scene stills already render verbatim).
      const result = input.text
        ? await previewCustomFrameThumbnail(id, { ...input, text: input.text })
        : await previewFrameThumbnail(id, input.atSeconds, input.aspectRatio);
      setFlattenedPreviewUrl(result.imageDataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }, [composeInput, id]);

  const stageDraft = useCallback(
    () => run(() => stageThumbnailDraft(id, composeInput())),
    [composeInput, id, run]
  );

  const uploadFinal = useCallback(
    // Always stage first so what lands on S3 is exactly the current canvas.
    () =>
      run(async () => {
        await stageThumbnailDraft(id, composeInput());
        return saveThumbnailDraft(id);
      }),
    [composeInput, id, run]
  );

  const dragOverlayText = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (busy || previewing) return;
      const frame = stageRef.current;
      if (!frame) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const update = (clientX: number, clientY: number) => {
        const rect = frame.getBoundingClientRect();
        patchOverlay({
          xPct: Math.min(0.98, Math.max(0.02, (clientX - rect.left) / rect.width)),
          yPct: Math.min(0.98, Math.max(0.02, (clientY - rect.top) / rect.height)),
        });
      };
      update(event.clientX, event.clientY);
      const onMove = (move: PointerEvent) => update(move.clientX, move.clientY);
      const onUp = () => window.removeEventListener("pointermove", onMove);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
    },
    [busy, patchOverlay, previewing]
  );

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
        <Link to="/studio/$id" params={{ id }} className="text-sm text-primary">
          ← Back to studio
        </Link>
      </section>
    );
  }

  const isGenerating = ACTIVE.includes(reel.status);
  const hasDraft = Boolean(reel.thumbnailDraft);
  const savedThumbnailUrl = reel.review?.thumbnailUrl;
  const output = outputSize(aspectRatio);
  const overlayText = wrapOverlayText(overlay, output.width);
  const showLiveOverlay = !flattenedPreviewUrl && overlayText.trim();
  const stageScale = stageWidth / output.width;
  const overlayPx = Math.max(6, overlay.fontSize * stageScale);
  const outlinePx = overlay.outlineWidth > 0 ? Math.max(0.5, overlay.outlineWidth * stageScale) : 0;
  const aspectCss = aspectRatio === "9:16" ? "9 / 16" : aspectRatio === "1:1" ? "1 / 1" : "16 / 9";
  const stageMaxWidth = aspectRatio === "9:16" ? "min(100%, 340px)" : aspectRatio === "1:1" ? "min(100%, 480px)" : "min(100%, 680px)";
  const disableEdits = busy || previewing || isGenerating;

  return (
    <section className="studio-workspace w-full min-w-0 overflow-x-clip text-foreground">
      <header className="sticky top-0 z-20 flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to="/studio/$id"
            params={{ id }}
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Back to studio"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <h1 className="m-0 min-w-0 truncate text-sm font-semibold tracking-normal text-foreground">
              Thumbnail studio · {reel.title || "Untitled reel"}
            </h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {reel.niche} · <ReelStatusChip status={reel.status} size="sm" />
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {hasDraft ? (
            <span className="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
              Local draft — not uploaded
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Refresh"
            onClick={() => void refresh()}
            disabled={busy}
          >
            <RefreshCw size={15} className={isGenerating ? "animate-spin" : undefined} />
          </Button>
        </div>
      </header>

      <div className="px-3 pb-6 pt-3 sm:px-4 lg:px-5">
      {error ? (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {hasDraft ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm text-warning">
          <div>
            <div className="font-semibold">Staged thumbnail draft</div>
            <div className="text-xs">
              The composed image lives only on this server. Upload publishes it to S3 (and deletes the
              thumbnail it replaces); discard wipes the local files.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="default" disabled={busy} onClick={() => void run(() => saveThumbnailDraft(id))}>
              <CloudUpload size={15} /> Upload staged draft
            </Button>
            <Button
              type="button"
              size="default"
              variant="outline"
              disabled={busy}
              onClick={() => void run(() => discardThumbnailDraft(id))}
            >
              <Trash2 size={15} /> Discard
            </Button>
          </div>
        </div>
      ) : null}

      {isGenerating ? (
        <div className="mb-3 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          Generation is active — thumbnail editing unlocks when the reel settles.
        </div>
      ) : null}

      <div className="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(230px,290px)_minmax(0,1fr)_minmax(300px,360px)]">
        {/* ---- Source rail ---- */}
        <aside className="grid min-w-0 content-start gap-3 xl:sticky xl:top-[61px] xl:max-h-[calc(100vh-73px)] xl:overflow-y-auto xl:pr-1">
          <StudioPanel title="Source" icon={<ImageIcon size={15} />}>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={sourceType === "scene" ? "default" : "outline"}
                disabled={disableEdits || sceneStills.length === 0}
                onClick={() => {
                  setSourceType("scene");
                  setFlattenedPreviewUrl(undefined);
                }}
              >
                <ImageIcon size={15} /> Scene still
              </Button>
              <Button
                type="button"
                variant={sourceType === "frame" ? "default" : "outline"}
                disabled={disableEdits || !reel.outputUrl}
                onClick={() => {
                  setSourceType("frame");
                  setFlattenedPreviewUrl(undefined);
                }}
              >
                <Clapperboard size={15} /> Video frame
              </Button>
            </div>

            {sourceType === "scene" ? (
              sceneStills.length ? (
                <div className="grid max-h-[46vh] grid-cols-2 gap-2 overflow-y-auto pr-1">
                  {sceneStills.map(({ scene, url }) => (
                    <button
                      key={scene.index}
                      type="button"
                      disabled={disableEdits}
                      onClick={() => {
                        setSceneIndex(scene.index);
                        setFlattenedPreviewUrl(undefined);
                      }}
                      className={cn(
                        "group overflow-hidden rounded-md border bg-black/45 text-left transition-colors",
                        sceneIndex === scene.index
                          ? "border-primary ring-1 ring-primary/60"
                          : "border-border hover:border-input"
                      )}
                      title={`Use scene ${scene.index + 1} still`}
                    >
                      <img src={url} alt="" className="aspect-video w-full object-cover" />
                      <span className="block truncate px-1.5 py-1 text-[11px] font-medium text-muted-foreground">
                        Scene {scene.index + 1}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/80">No scene stills yet — generate the reel first.</p>
              )
            ) : (
              <div className="grid gap-2">
                <Label className="text-xs text-muted-foreground">
                  Video time — {frameSeconds.toFixed(1)}s
                  <input
                    type="range"
                    min={0}
                    max={Math.max(videoDuration, 1)}
                    step={0.1}
                    value={Math.min(frameSeconds, Math.max(videoDuration, 1))}
                    disabled={disableEdits || !reel.outputUrl}
                    onChange={(event) => setFrameSeconds(Number(event.target.value))}
                    className="w-full accent-[var(--color-primary)]"
                  />
                </Label>
                <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                  <Label className="text-xs text-muted-foreground">
                    Seconds
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      disabled={disableEdits || !reel.outputUrl}
                      value={frameSeconds}
                      onChange={(event) => setFrameSeconds(Math.max(Number(event.target.value) || 0, 0))}
                    />
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-border bg-secondary text-foreground hover:bg-accent"
                    disabled={disableEdits || grabbingFrame || !reel.outputUrl}
                    onClick={() => void grabFrame()}
                  >
                    {grabbingFrame ? <Loader2 className="animate-spin" size={15} /> : <Clapperboard size={15} />}
                    Grab frame
                  </Button>
                </div>
                {!reel.outputUrl ? (
                  <p className="text-xs text-muted-foreground/80">Render the reel to pull frames from the video.</p>
                ) : null}
              </div>
            )}
          </StudioPanel>

          <StudioPanel title="Saved thumbnail" icon={<CloudUpload size={15} />}>
            {savedThumbnailUrl ? (
              <img
                src={savedThumbnailUrl}
                alt="Saved thumbnail"
                className="w-full rounded-md border border-border object-cover"
              />
            ) : (
              <p className="text-xs text-muted-foreground/80">
                Nothing uploaded yet. The published thumbnail will show here.
              </p>
            )}
            {reel.thumbnailDraft ? (
              <div className="grid gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-warning">
                  Staged draft (local)
                </span>
                <img
                  src={mediaUrl(reel.thumbnailDraft.imageUrl)}
                  alt="Staged thumbnail draft"
                  className="w-full rounded-md border border-warning/50 object-cover"
                />
              </div>
            ) : null}
          </StudioPanel>
        </aside>

        {/* ---- Canvas ---- */}
        <main className="grid min-w-0 content-start gap-3">
          <StudioPanel
            title={flattenedPreviewUrl ? "Canvas · exact render preview" : "Canvas · live edit"}
            icon={<ImageIcon size={15} />}
            actions={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGuides((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium",
                    showGuides
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Grid3x3 size={13} /> Guides
                </button>
                <span className="rounded-full border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  {aspectRatio} · {output.width}×{output.height}
                </span>
              </div>
            }
          >
            <div className="grid place-items-center bg-black/20 p-4">
              <div
                ref={stageRef}
                className="relative grid place-items-center overflow-hidden rounded-md border border-border bg-black"
                style={{ aspectRatio: aspectCss, width: stageMaxWidth }}
              >
                {flattenedPreviewUrl ? (
                  <img src={flattenedPreviewUrl} alt="Exact render preview" className="h-full w-full object-cover" />
                ) : sourceImageUrl ? (
                  <img src={sourceImageUrl} alt="Thumbnail source" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid gap-2 px-4 text-center text-xs font-semibold text-muted-foreground/80">
                    <ImageIcon className="mx-auto" size={28} />
                    {sourceType === "frame" ? "Grab a video frame to start" : "Pick a scene still to start"}
                  </div>
                )}

                {showGuides && !flattenedPreviewUrl ? (
                  <div className="pointer-events-none absolute inset-0">
                    {/* rule-of-thirds grid + title-safe margin */}
                    <div className="absolute inset-y-0 left-1/3 w-px bg-primary/20" />
                    <div className="absolute inset-y-0 left-2/3 w-px bg-primary/20" />
                    <div className="absolute inset-x-0 top-1/3 h-px bg-primary/20" />
                    <div className="absolute inset-x-0 top-2/3 h-px bg-primary/20" />
                    <div className="absolute inset-[6%] rounded border border-dashed border-primary/25" />
                  </div>
                ) : null}

                {showLiveOverlay ? (
                  <div
                    role="presentation"
                    onPointerDown={dragOverlayText}
                    className={cn(
                      // whitespace-pre: line breaks come from wrapOverlayText (the
                      // server's algorithm), never from CSS re-wrapping.
                      "absolute cursor-grab select-none whitespace-pre rounded px-1 font-black leading-tight tracking-normal active:cursor-grabbing",
                      overlay.effect === "box" ? "bg-black/55" : ""
                    )}
                    style={{
                      left: `${overlay.xPct * 100}%`,
                      top: `${overlay.yPct * 100}%`,
                      width: `${overlay.widthPct * 100}%`,
                      color: overlay.color,
                      fontSize: overlayPx,
                      fontFamily: overlay.fontFamily || undefined,
                      lineHeight: overlay.lineHeight,
                      textAlign: overlay.align,
                      WebkitTextStroke: outlinePx > 0 ? `${outlinePx}px ${overlay.outlineColor}` : undefined,
                      paintOrder: "stroke fill",
                      textShadow:
                        overlay.effect === "none"
                          ? "none"
                          : overlay.effect === "glow"
                            ? `0 0 5px ${overlay.color}, 0 0 12px ${overlay.color}, 0 3px 7px rgba(0,0,0,.55)`
                            : "0 3px 7px rgba(0,0,0,.55)",
                      // ffmpeg drawtext anchors y at the TOP of the text block —
                      // mirror that (translate X only) so the canvas is WYSIWYG.
                      transform: "translate(-50%, 0)",
                    }}
                  >
                    {overlayText}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              {flattenedPreviewUrl
                ? "Server-rendered preview — exactly what will be saved. Change any control to return to live edit."
                : "Live edit: drag the text to position it. Staging or uploading flattens source + text server-side into one PNG."}
            </div>
          </StudioPanel>

          <StudioPanel title="Actions" icon={<Save size={15} />}>
            <div className="grid gap-2 sm:grid-cols-3">
              <Button
                type="button"
                variant="outline"
                className="border-border bg-secondary text-foreground hover:bg-accent"
                disabled={disableEdits || !sourceReady || (sourceType === "scene" && !overlay.text.trim())}
                title={
                  sourceType === "scene" && !overlay.text.trim()
                    ? "Scene stills without text render verbatim — add text to preview the composite"
                    : undefined
                }
                onClick={() => void previewExact()}
              >
                {previewing ? <Loader2 className="animate-spin" size={15} /> : <ImageIcon size={15} />}
                Preview exact render
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-warning/50 bg-warning/10 text-warning hover:bg-warning/15"
                disabled={disableEdits || !sourceReady}
                onClick={() => void stageDraft()}
              >
                <Save size={15} /> Save draft (local)
              </Button>
              <Button type="button" disabled={disableEdits || !sourceReady} onClick={() => void uploadFinal()}>
                {busy ? <Loader2 className="animate-spin" size={15} /> : <CloudUpload size={15} />}
                Upload to S3
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground/80">
              Previews are rendered to temp files and deleted immediately. A saved draft keeps one composed
              PNG locally until you upload or discard it — uploading replaces (and deletes) the previous S3
              thumbnail, so only one object per reel ever lives in the bucket.
            </p>
          </StudioPanel>
        </main>

        {/* ---- Controls rail ---- */}
        <div className="grid min-w-0 content-start gap-3 xl:sticky xl:top-[61px] xl:max-h-[calc(100vh-73px)] xl:overflow-y-auto xl:pr-1">
          <StudioPanel title="Layout" icon={<Grid3x3 size={15} />}>
            <Label className="text-xs text-muted-foreground">
              Aspect ratio
              <Select
                disabled={disableEdits}
                value={aspectRatio}
                onChange={(event) => {
                  setAspectRatio(event.target.value as ThumbnailAspectRatio);
                  setFlattenedPreviewUrl(undefined);
                  setFramePreviewUrl(undefined);
                }}
              >
                <option value="16:9">16:9 landscape — YouTube default</option>
                <option value="9:16">9:16 vertical — Shorts/mobile</option>
                <option value="1:1">1:1 square</option>
              </Select>
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {/* y anchors the TOP of the text block (ffmpeg drawtext semantics) */}
              {([
                ["Top", 0.08],
                ["Middle", 0.42],
                ["Bottom", 0.7],
              ] as const).map(([label, y]) => (
                <Button
                  key={label}
                  type="button"
                  variant="outline"
                  className="border-border bg-secondary text-xs text-foreground hover:bg-accent"
                  disabled={disableEdits}
                  onClick={() => patchOverlay({ xPct: 0.5, yPct: y })}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Label className="text-xs text-muted-foreground">
                X %
                <Input
                  type="number"
                  min={0}
                  max={100}
                  disabled={disableEdits}
                  value={Math.round(overlay.xPct * 100)}
                  onChange={(event) =>
                    patchOverlay({ xPct: Math.min(1, Math.max(0, Number(event.target.value) / 100 || 0)) })
                  }
                />
              </Label>
              <Label className="text-xs text-muted-foreground">
                Y %
                <Input
                  type="number"
                  min={0}
                  max={100}
                  disabled={disableEdits}
                  value={Math.round(overlay.yPct * 100)}
                  onChange={(event) =>
                    patchOverlay({ yPct: Math.min(1, Math.max(0, Number(event.target.value) / 100 || 0)) })
                  }
                />
              </Label>
              <Label className="text-xs text-muted-foreground">
                Wrap width %
                <Input
                  type="number"
                  min={20}
                  max={100}
                  disabled={disableEdits}
                  value={Math.round(overlay.widthPct * 100)}
                  onChange={(event) =>
                    patchOverlay({ widthPct: Math.min(1, Math.max(0.2, Number(event.target.value) / 100 || 0.2)) })
                  }
                />
              </Label>
              <Label className="text-xs text-muted-foreground">
                Line height
                <Input
                  type="number"
                  min={0.8}
                  max={2}
                  step={0.05}
                  disabled={disableEdits}
                  value={overlay.lineHeight}
                  onChange={(event) =>
                    patchOverlay({ lineHeight: Math.min(2, Math.max(0.8, Number(event.target.value) || 1.12)) })
                  }
                />
              </Label>
            </div>
          </StudioPanel>

          <StudioPanel title="Text overlay" icon={<Type size={15} />}>
            <Textarea
              disabled={disableEdits}
              value={overlay.text}
              maxLength={180}
              rows={3}
              placeholder="Thumbnail hook text. Line breaks are kept. Leave empty for a clean image."
              onChange={(event) => patchOverlay({ text: event.target.value })}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <Label className="text-xs text-muted-foreground">
                Font
                <Select
                  disabled={disableEdits}
                  value={overlay.fontFamily}
                  onChange={(event) => patchOverlay({ fontFamily: event.target.value })}
                >
                  {fonts.map((font) => (
                    <option key={font.id} value={font.family}>
                      {font.label}
                    </option>
                  ))}
                </Select>
              </Label>
              <Label className="text-xs text-muted-foreground">
                Align
                <Select
                  disabled={disableEdits}
                  value={overlay.align}
                  onChange={(event) => patchOverlay({ align: event.target.value as OverlayState["align"] })}
                >
                  <option value="center">Center</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </Select>
              </Label>
              <Label className="text-xs text-muted-foreground">
                Size ({overlay.fontSize}px @ {output.width}w)
                <Input
                  type="number"
                  min={20}
                  max={400}
                  disabled={disableEdits}
                  value={overlay.fontSize}
                  onChange={(event) =>
                    patchOverlay({ fontSize: Math.min(400, Math.max(20, Number(event.target.value) || 120)) })
                  }
                />
              </Label>
              <Label className="text-xs text-muted-foreground">
                Outline width
                <Input
                  type="number"
                  min={0}
                  max={30}
                  disabled={disableEdits}
                  value={overlay.outlineWidth}
                  onChange={(event) =>
                    patchOverlay({ outlineWidth: Math.min(30, Math.max(0, Number(event.target.value) || 0)) })
                  }
                />
              </Label>
              <Label className="text-xs text-muted-foreground">
                Text color
                <input
                  type="color"
                  className="h-9 w-full rounded border border-border bg-background"
                  disabled={disableEdits}
                  value={overlay.color}
                  onChange={(event) => patchOverlay({ color: event.target.value })}
                />
              </Label>
              <Label className="text-xs text-muted-foreground">
                Outline color
                <input
                  type="color"
                  className="h-9 w-full rounded border border-border bg-background"
                  disabled={disableEdits}
                  value={overlay.outlineColor}
                  onChange={(event) => patchOverlay({ outlineColor: event.target.value })}
                />
              </Label>
            </div>
            <Label className="text-xs text-muted-foreground">
              Text effect
              <Select
                disabled={disableEdits}
                value={overlay.effect}
                onChange={(event) => patchOverlay({ effect: event.target.value as OverlayState["effect"] })}
              >
                <option value="shadow">Drop shadow</option>
                <option value="glow">Glow</option>
                <option value="box">Dark backing box</option>
                <option value="none">None</option>
              </Select>
            </Label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={overlay.uppercase}
                disabled={disableEdits}
                onChange={(event) => patchOverlay({ uppercase: event.target.checked })}
              />
              ALL CAPS
            </label>
          </StudioPanel>

          <StudioPanel title="AI thumbnail" icon={<Sparkles size={15} />}>
            <Label className="text-xs text-muted-foreground">
              Prompt
              <Textarea
                rows={3}
                disabled={disableEdits}
                value={aiPrompt}
                placeholder="Describe the thumbnail scene to generate."
                onChange={(event) => setAiPrompt(event.target.value)}
              />
            </Label>
            <Button
              type="button"
              variant="outline"
              className="border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
              disabled={disableEdits || !aiPrompt.trim()}
              onClick={() =>
                setConfirmAction({
                  title: "Generate AI thumbnail?",
                  body: "This makes one paid OpenRouter image request, composites the hook text, and uploads the result to S3 as the reel's thumbnail.",
                  details: [
                    "The previous S3 thumbnail is replaced and deleted.",
                    "Any staged local draft is left untouched — discard it if you keep the AI result.",
                  ],
                  confirmLabel: "Generate ($)",
                  onConfirm: () =>
                    run(async () => {
                      const review = await regenerateThumbnail(id, { thumbnailPrompt: aiPrompt.trim() });
                      return { ...reel, review };
                    }),
                })
              }
            >
              <Wand2 size={15} /> Generate with AI ($)
            </Button>
            <p className="text-[11px] text-muted-foreground/80">
              Uses the reel's title and this prompt to render a full AI thumbnail — separate from the canvas
              composition above.
            </p>
          </StudioPanel>
        </div>
      </div>
      </div>

      <ConfirmDialog action={confirmAction} busy={busy} onClose={() => setConfirmAction(undefined)} />
    </section>
  );
}

function StudioPanel({
  title,
  icon,
  actions,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card">
      <div className="flex min-h-10 items-center justify-between gap-3 border-b border-border px-3 py-2">
        <strong className="section-label inline-flex min-w-0 items-center gap-2">
          {icon ? <span className="text-muted-foreground/70">{icon}</span> : null}
          <span className="truncate">{title}</span>
        </strong>
        {actions}
      </div>
      <div className="grid min-w-0 gap-2.5 p-3">{children}</div>
    </section>
  );
}
