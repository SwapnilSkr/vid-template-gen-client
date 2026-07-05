import { getRouteApi, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addScene,
  approvePlan,
  getReel,
  listReelSeries,
  listArtStyles,
  listFonts,
  listImageModels,
  listTtsVoices,
  regenerateReel,
  regenerateScene,
  removeScene,
  replanReel,
  updateCaptions,
  updateReelSettings,
  updateScene,
  type ArtStyleOption,
  type CaptionStyle,
  type EditEffects,
  type FontOption,
  type ImageModelOption,
  type Reel,
  type Scene,
  type TtsVoiceOption,
} from "@/api/reels";
import { listHorrorReferences, type HorrorReference } from "@/api/trends";
import { EditEffectsControls } from "@/components/reels/EditEffectsControls";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelTitle, panelClassName } from "@/components/ui/panel";
import { MOTION_MODES } from "@/constants/reels";
import { cn } from "@/lib/utils";

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
const CAPTION_DEFAULTS: Required<Omit<CaptionStyle, "animation">> & { animation: "none" | "pop" } = {
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
};

const VOICE_POST_PROFILES: { value: NonNullable<Reel["audioPost"]>["voiceProfile"]; label: string }[] = [
  { value: "horror", label: "Dark narrator - low, compressed, room echo" },
  { value: "whisper", label: "Whisper room - close, breathy, uneasy" },
  { value: "phone", label: "Phone recording - narrow, distorted call" },
  { value: "tape", label: "Analog tape - degraded recorder, slight wobble" },
  { value: "distant", label: "Distant basement - muffled, far-room echo" },
  { value: "none", label: "Clean - no voice FX" },
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
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | undefined>();

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
        <Link to="/" search={{ status: undefined }} className="text-sm text-primary">
          ← Back to reels
        </Link>
      </section>
    );
  }

  const isGenerating = ACTIVE.includes(reel.status);
  const scenes = reel.scenes ?? [];
  const previewUrl = reel.outputUrl
    ? `${reel.outputUrl}${reel.outputUrl.includes("?") ? "&" : "?"}v=${encodeURIComponent(reel.updatedAt ?? String(reel.progress))}`
    : undefined;

  return (
    <section className="min-w-0 px-4 py-4 sm:px-5 lg:px-6">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link to="/" search={{ status: undefined }} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="m-0 flex items-center gap-2 text-xl tracking-normal text-foreground">
              <Wand2 size={20} className="text-primary" />
              {reel.title || "Untitled reel"}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {reel.niche} · {reel.genre ?? "—"} · <StatusBadge status={reel.status} /> · {reel.progress}%
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => void refresh()} disabled={busy}>
          <RefreshCw size={15} className={isGenerating ? "animate-spin" : undefined} />
          Refresh
        </Button>
      </header>

      {error ? (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <ReelContextBar reel={reel} seriesReels={seriesReels} currentId={id} />

      <GateBanner
        reel={reel}
        busy={busy}
        onApprove={() =>
          setConfirmAction({
            title: reel.partCount && reel.partCount > 1 ? `Generate part ${reel.partNumber ?? 1}?` : "Generate reel?",
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

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
        <div className="grid min-w-0 gap-3">
          <StoryPanel reel={reel} busy={busy} run={run} />
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <PanelTitle>Scenes ({scenes.length})</PanelTitle>
              <Button
                type="button"
                variant="outline"
                size="default"
                disabled={busy || isGenerating}
                onClick={() =>
                  void run(() => addScene(id, { narration: "New scene narration." }))
                }
              >
                + Add scene
              </Button>
            </div>
            {scenes.map((scene) => (
              <SceneCard
                key={scene.index}
                reelId={id}
                scene={scene}
                total={scenes.length}
                busy={busy}
                disabled={isGenerating}
                run={run}
                requestConfirm={setConfirmAction}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-3 xl:sticky xl:top-4">
          {previewUrl ? (
            <div className={cn(panelClassName, "grid gap-2 p-3")}>
              <PanelTitle>Preview</PanelTitle>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                key={previewUrl}
                src={previewUrl}
                controls
                className="aspect-[9/16] w-full rounded-lg bg-black"
              />
            </div>
          ) : null}
          <PresetsPanel reel={reel} busy={busy} run={run} requestConfirm={setConfirmAction} />
          <EffectsPanel reel={reel} busy={busy} run={run} />
          <CaptionEditor reel={reel} busy={busy} run={run} />
          <RegeneratePanel reel={reel} busy={busy} run={run} requestConfirm={setConfirmAction} />
        </div>
      </div>
      <ConfirmModal action={confirmAction} busy={busy} onClose={() => setConfirmAction(undefined)} />
    </section>
  );
}

function StatusBadge({ status }: { status: Reel["status"] }) {
  const label = status === "plan_review" ? "awaiting review" : status.replace(/_/g, " ");
  return <span className="font-semibold text-foreground">{label}</span>;
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
      <div className="grid w-full max-w-md gap-3 rounded-lg border border-border bg-card p-4 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <strong className="text-base text-foreground">{action.title}</strong>
            <p className="m-0 text-sm leading-relaxed text-muted-foreground">{action.body}</p>
          </div>
          <Button type="button" size="icon" variant="ghost" disabled={busy} onClick={onClose}>
            <X size={16} />
          </Button>
        </div>
        {action.details?.length ? (
          <div className="grid gap-1 rounded-md border border-border bg-muted/35 p-2.5 text-xs text-muted-foreground">
            {action.details.map((detail) => (
              <div key={detail} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{detail}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={action.variant === "destructive" ? "destructive" : "default"}
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

function statusTone(status: Reel["status"]): string {
  if (status === "completed") return "border-success/30 bg-success/10 text-success-foreground";
  if (status === "failed") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (status === "plan_review") return "border-warning/40 bg-warning/10 text-warning-foreground";
  return "border-border bg-muted text-muted-foreground";
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
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
        <span className="font-extrabold text-foreground">Standalone reel</span>
        <span className="text-muted-foreground">Scenes, voice, captions, and render settings apply only to this reel.</span>
      </div>
    );
  }

  const parts = seriesReels.length ? seriesReels : [reel];
  return (
    <div className="mb-3 grid gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs">
          <span className="font-extrabold text-foreground">Series</span>
          <span className="ml-2 text-muted-foreground">
            Part {reel.partNumber ?? 1} of {reel.partCount ?? parts.length}
          </span>
        </div>
        <span className="text-[11px] font-bold text-muted-foreground">
          Edit and generate each part independently.
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {parts.map((part) => {
          const id = reelKey(part);
          const active = id === currentId;
          return (
            <Link
              key={id || `${part.partNumber}`}
              to="/studio/$id"
              params={{ id }}
              className={cn(
                "grid min-w-36 gap-1 rounded-md border px-3 py-2 text-left text-xs no-underline",
                active ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-accent"
              )}
            >
              <span className="font-extrabold text-foreground">
                Part {part.partNumber ?? 1}
              </span>
              <span className="truncate text-muted-foreground">{part.title || part.topic || "Untitled"}</span>
              <span className={cn("w-fit rounded-full border px-2 py-0.5 text-[10px] font-bold", statusTone(part.status))}>
                {part.status === "plan_review" ? "review" : part.status}
              </span>
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
        <span className="font-bold text-foreground">
          {reel.partCount && reel.partCount > 1
            ? `Part ${reel.partNumber ?? 1} plan ready — review & edit this episode below.`
            : "Plan ready — review & edit the script, art, voice, and captions below."}
        </span>
        <span className="text-muted-foreground">No images/voice have been generated yet (no spend).</span>
      </div>
      <Button type="button" variant="default" disabled={busy} onClick={onApprove}>
        {busy ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
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
    <div className={cn(panelClassName, "grid gap-3 p-3.5")}>
      <PanelTitle>Story</PanelTitle>

      {reel.horrorReference ? (
        <div className="rounded-md border border-border bg-muted/40 p-2.5 text-xs">
          <div className="font-bold text-foreground">Reference used</div>
          <a
            href={reel.horrorReference.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary"
          >
            {reel.horrorReference.title} <ExternalLink size={12} />
          </a>
          <span className="ml-1 text-muted-foreground">
            {reel.horrorReference.author ? `· ${reel.horrorReference.author}` : ""}{" "}
            {reel.horrorReference.license ?? ""}
          </span>
        </div>
      ) : null}

      {bible ? (
        <div className="grid gap-1 rounded-md border border-border bg-background/60 p-2.5 text-xs">
          <div className="font-bold text-foreground">{bible.premise}</div>
          <div className="text-muted-foreground">
            Anchor: {bible.anchorObject} · Rule: {bible.impossibleRule}
          </div>
          <div className="text-muted-foreground">Twist: {bible.finalTwist}</div>
        </div>
      ) : null}

      <Label>
        Pick a scraped reference (optional)
        <Select
          disabled={busy}
          value={reel.horrorReferenceId ?? ""}
          onChange={(e) =>
            void run(() => replanReel(reel._id ?? reel.id ?? "", { horrorReferenceId: e.target.value }))
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

      <Label>
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
        disabled={busy || !script.trim()}
        onClick={() =>
          void run(() => replanReel(reel._id ?? reel.id ?? "", { providedScript: script.trim() }))
        }
      >
        <RefreshCw size={15} /> Re-plan from my story
      </Button>
    </div>
  );
}

function SceneCard({
  reelId,
  scene,
  total,
  busy,
  disabled,
  run,
  requestConfirm,
}: {
  reelId: string;
  scene: Scene;
  total: number;
  busy: boolean;
  disabled: boolean;
  run: (a: () => Promise<Reel>) => Promise<void>;
  requestConfirm: (action: ConfirmAction) => void;
}) {
  const [narration, setNarration] = useState(scene.narration);
  const [visualPrompt, setVisualPrompt] = useState(scene.visualPrompt);
  const dirty = narration !== scene.narration || visualPrompt !== scene.visualPrompt;

  useEffect(() => {
    setNarration(scene.narration);
    setVisualPrompt(scene.visualPrompt);
  }, [scene.narration, scene.visualPrompt]);

  const disableAll = busy || disabled;

  return (
    <div className={cn(panelClassName, "grid grid-cols-[110px_1fr] gap-3 p-3")}>
      <div className="grid gap-1.5">
        <div className="grid aspect-[9/16] w-full place-items-center overflow-hidden rounded-md border border-border bg-muted text-muted-foreground">
          {scene.assetUrl ? (
            <img src={scene.assetUrl} alt={`Scene ${scene.index + 1}`} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon size={20} />
          )}
        </div>
        <span className="text-center text-[11px] font-bold text-muted-foreground">
          Scene {scene.index + 1}/{total}
        </span>
        {scene.audioUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio src={scene.audioUrl} controls className="h-7 w-full" />
        ) : (
          <span className="inline-flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            <Play size={11} /> no audio
          </span>
        )}
      </div>

      <div className="grid min-w-0 gap-2">
        <Label className="gap-1 text-xs">
          Narration
          <Textarea
            rows={3}
            value={narration}
            disabled={disableAll}
            onChange={(e) => setNarration(e.target.value)}
          />
        </Label>
        <Label className="gap-1 text-xs">
          Visual prompt
          <Textarea
            rows={2}
            value={visualPrompt}
            disabled={disableAll}
            onChange={(e) => setVisualPrompt(e.target.value)}
          />
        </Label>
        <div className="flex flex-wrap items-center gap-1.5">
          <Select
            className="h-8 w-auto text-xs"
            disabled={disableAll}
            value={scene.motion.type}
            onChange={(e) =>
              void run(() =>
                updateScene(reelId, scene.index, {
                  motion: { ...scene.motion, type: e.target.value as Scene["motion"]["type"] },
                })
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
            onClick={() => void run(() => updateScene(reelId, scene.index, { narration, visualPrompt }))}
          >
            {dirty ? "Save" : "Saved"}
          </Button>
          <Button
            type="button"
            size="default"
            variant="outline"
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
                onConfirm: () => run(() => regenerateScene(reelId, scene.index, ["image"])),
              })
            }
          >
            <ImageIcon size={13} /> Image
          </Button>
          <Button
            type="button"
            size="default"
            variant="outline"
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
                onConfirm: () => run(() => regenerateScene(reelId, scene.index, ["audio"])),
              })
            }
          >
            <Play size={13} /> Audio
          </Button>
          {total > 1 ? (
            <Button
              type="button"
              size="default"
              variant="ghost"
              className="text-destructive"
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
              Remove
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
    void listArtStyles("horror").then(setArtStyles).catch(() => undefined);
    void listImageModels().then(setImageModels).catch(() => undefined);
    void listTtsVoices().then(setVoices).catch(() => undefined);
  }, []);

  const currentVoice = reel.voiceOverride?.voice ?? reel.narrationVoice?.voice ?? "";

  return (
    <div className={cn(panelClassName, "grid gap-2.5 p-3")}>
      <PanelTitle>Look & Voice</PanelTitle>

      <Label className="text-xs">
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
              onConfirm: () => run(() => updateReelSettings(reelKey, { artStyleId })),
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

      <Label className="text-xs">
        Motion
        <Select
          disabled={busy}
          value={reel.motionMode ?? "ken_burns"}
          onChange={(e) =>
            void run(() => updateReelSettings(reelKey, { motionMode: e.target.value as Reel["motionMode"] }))
          }
        >
          {MOTION_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </Label>

      <Label className="text-xs">
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
              onConfirm: () => run(() => updateReelSettings(reelKey, { imageModel })),
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

      <Label className="text-xs">
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
                run(() => updateReelSettings(reelKey, { voice: { model: v.model, voice: v.voice, format: v.format } })),
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

      <Label className="text-xs">
        Voice post-processing
        <Select
          disabled={busy}
          value={reel.audioPost?.voiceProfile ?? "horror"}
          onChange={(e) => {
            const voiceProfile = e.target.value as NonNullable<Reel["audioPost"]>["voiceProfile"];
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
              })
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
      <p className="text-[11px] text-muted-foreground">
        Changing art/image model clears stills; changing voice or voice FX clears narration. Re-render below to apply.
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
    <div className={cn(panelClassName, "grid gap-2 p-3")}>
      <PanelTitle>Regenerate</PanelTitle>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => void run(() => regenerateReel(reelKey, "render_only"))}
      >
        <RefreshCw size={15} /> Re-render (reuse assets — free)
      </Button>
      <Button
        type="button"
        variant="outline"
        className="border-destructive/40 text-destructive"
        disabled={busy}
        onClick={() =>
          requestConfirm({
            title: "Regenerate all assets?",
            body: "This clears every scene image and narration clip, then queues a full asset produce run.",
            details: [
              "Costs OpenRouter image generation for every scene.",
              "Costs OpenRouter TTS for every scene.",
              "Rebuilds and uploads the final preview video after generation.",
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
    <div className={cn(panelClassName, "grid gap-2.5 p-3")}>
      <PanelTitle>Edit Effects</PanelTitle>
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
      <p className="text-[11px] text-muted-foreground">
        A cinematic finish over the whole reel. Render-only — reuses every asset, no generation spend.
      </p>
    </div>
  );
}

// ---- Live caption editor ----

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
  const initial = useMemo<Required<Omit<CaptionStyle, "animation">> & { animation: "none" | "pop" }>(
    () => ({ ...CAPTION_DEFAULTS, ...(reel.captionStyle ?? {}) }),
    [reel.captionStyle]
  );
  const [style, setStyle] = useState(initial);
  useEffect(() => setStyle(initial), [initial]);
  const [fonts, setFonts] = useState<FontOption[]>([]);
  useEffect(() => {
    void listFonts().then(setFonts).catch(() => setFonts([]));
  }, []);
  const previewRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const bg = reel.scenes?.find((s) => s.assetUrl)?.assetUrl;
  const set = <K extends keyof typeof style>(k: K, v: (typeof style)[K]) =>
    setStyle((s) => ({ ...s, [k]: v }));

  // Map drag Y → marginV (distance from the alignment's vertical anchor edge).
  const onPointerMove = useCallback(
    (clientY: number) => {
      const el = previewRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scaleY = 1920 / rect.height;
      const yInPreview = Math.min(Math.max(clientY - rect.top, 0), rect.height);
      setStyle((s) => {
        const band = Math.floor((s.alignment - 1) / 3); // 0 bottom, 1 middle, 2 top
        let marginV: number;
        if (band === 2) marginV = yInPreview * scaleY; // top anchor
        else if (band === 0) marginV = (rect.height - yInPreview) * scaleY; // bottom anchor
        else marginV = Math.abs(rect.height / 2 - yInPreview) * scaleY; // middle offset
        return { ...s, marginV: Math.round(Math.min(Math.max(marginV, 0), 1900)) };
      });
    },
    []
  );

  useEffect(() => {
    const move = (e: PointerEvent) => draggingRef.current && onPointerMove(e.clientY);
    const up = () => (draggingRef.current = false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [onPointerMove]);

  // CSS position for the caption box mirroring ASS alignment + marginV.
  const band = Math.floor((style.alignment - 1) / 3); // 0 bottom,1 middle,2 top
  const captionPos: React.CSSProperties =
    band === 2
      ? { top: `${(style.marginV / 1920) * 100}%` }
      : band === 0
        ? { bottom: `${(style.marginV / 1920) * 100}%` }
        : { top: `calc(50% - ${(style.marginV / 1920) * 100}%)` };

  const word = (reel.title || "SAMPLE").split(/\s+/)[0] ?? "SAMPLE";
  const previewText = style.uppercase ? word.toUpperCase() : word;
  const outlinePx = Math.max(1, Math.round(style.outlineWidth / 2));

  return (
    <div className={cn(panelClassName, "grid gap-2.5 p-3")}>
      <PanelTitle>Captions (live)</PanelTitle>

      <div
        ref={previewRef}
        className="relative mx-auto aspect-[9/16] w-40 select-none overflow-hidden rounded-md border border-border bg-black"
        style={
          bg ? { backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined
        }
      >
        <div
          className="absolute left-0 right-0 flex cursor-grab justify-center px-1 active:cursor-grabbing"
          style={captionPos}
          onPointerDown={() => (draggingRef.current = true)}
        >
          <span
            style={{
              fontFamily: style.fontName,
              fontSize: `${(style.fontSize / 1080) * 160}px`,
              fontWeight: style.bold ? 800 : 500,
              color: style.primaryColor,
              WebkitTextStroke: `${outlinePx}px ${style.outlineColor}`,
              paintOrder: "stroke fill",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            {previewText}
          </span>
        </div>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">Drag the word to reposition</p>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Label className="gap-1">
          Font
          <Select value={style.fontName} disabled={busy} onChange={(e) => set("fontName", e.target.value)}>
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
        <Label className="gap-1">
          Size
          <Input
            type="number"
            value={style.fontSize}
            disabled={busy}
            onChange={(e) => set("fontSize", Number(e.target.value) || 0)}
          />
        </Label>
        <Label className="gap-1">
          Words/chunk
          <Input
            type="number"
            min={1}
            max={12}
            value={style.chunkSize}
            disabled={busy}
            onChange={(e) => set("chunkSize", Math.max(1, Number(e.target.value) || 1))}
          />
        </Label>
        <Label className="gap-1">
          Position
          <Select
            value={String(style.alignment)}
            disabled={busy}
            onChange={(e) => set("alignment", Number(e.target.value))}
          >
            <option value="2">Bottom</option>
            <option value="5">Middle</option>
            <option value="8">Top</option>
          </Select>
        </Label>
        <Label className="gap-1">
          Text color
          <input
            type="color"
            className="h-8 w-full rounded border border-border bg-background"
            value={style.primaryColor}
            disabled={busy}
            onChange={(e) => set("primaryColor", e.target.value)}
          />
        </Label>
        <Label className="gap-1">
          Highlight color
          <input
            type="color"
            className="h-8 w-full rounded border border-border bg-background"
            value={style.activeColor}
            disabled={busy}
            onChange={(e) => set("activeColor", e.target.value)}
          />
        </Label>
        <Label className="gap-1">
          Outline color
          <input
            type="color"
            className="h-8 w-full rounded border border-border bg-background"
            value={style.outlineColor}
            disabled={busy}
            onChange={(e) => set("outlineColor", e.target.value)}
          />
        </Label>
        <Label className="gap-1">
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

      <label className="flex items-center gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          checked={style.uppercase}
          disabled={busy}
          onChange={(e) => set("uppercase", e.target.checked)}
        />
        ALL CAPS
      </label>

      <Button
        type="button"
        variant="default"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            await updateCaptions(reelKey, style);
            // Render-only re-burn if the reel already has a video (free for
            // parallax/ken_burns); otherwise the captions apply on next produce.
            return reel.outputUrl ? regenerateReel(reelKey, "render_only") : getReel(reelKey);
          })
        }
      >
        <RefreshCw size={15} /> Apply captions {reel.outputUrl ? "& re-render" : ""}
      </Button>
    </div>
  );
}
