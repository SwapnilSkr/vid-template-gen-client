import { Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyCaptions,
  getReel,
  getWordAlignmentStatus,
  listFonts,
  updateCaptions,
  type CaptionStyle,
  type FontOption,
  type Reel,
  type WordAlignmentStatus,
} from "@/api/reels";
import { CaptionSmokeButton } from "@/components/reels/CaptionSmokeDialog";
import { CostChip, RenderCacheStatus, describeRenderCost } from "@/components/reels/RenderCostHint";
import {
  CAPTION_DEFAULTS,
  CAPTION_STYLE_DEFAULTS,
} from "@/components/studio/constants";
import type { ConfirmAction, StudioRun } from "@/components/studio/types";
import {
  captionPreviewWords,
  captionStyleFromReel,
  normalizeHexColor,
} from "@/components/studio/utils";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelTitle } from "@/components/ui/panel";
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
  canCompositeOnlyRerender,
  gameplayMissingTtsSegmentCount,
  gameplayRerenderCostsCredits,
} from "@/utils/reel";

export function CaptionEditor({
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
  const isRedditStory = reel.niche === "reddit" || reel.strategy === "gameplay_overlay";
  const [alignmentStatus, setAlignmentStatus] = useState<WordAlignmentStatus>();
  useEffect(() => {
    if (!isRedditStory) return;
    let cancelled = false;
    void getWordAlignmentStatus()
      .then((status) => {
        if (!cancelled) setAlignmentStatus(status);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAlignmentStatus({
            enabled: false,
            ready: false,
            detail: error instanceof Error ? error.message : "Could not check local word sync.",
          });
        }
      });
    return () => { cancelled = true; };
  }, [isRedditStory]);
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
      ).catch(() => undefined);
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
      {isRedditStory ? (
        <div
          role="status"
          className={cn(
            "grid gap-0.5 rounded-md border px-2.5 py-2 text-[11px]",
            alignmentStatus?.ready
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : alignmentStatus?.enabled
                ? "border-warning/40 bg-warning/10 text-warning"
                : "border-border bg-muted/40 text-muted-foreground",
          )}
        >
          <span className="font-medium">
            {alignmentStatus
              ? alignmentStatus.ready ? "Local word sync ready" : "Local word sync unavailable"
              : "Checking local word sync…"}
          </span>
          {alignmentStatus ? <span className="leading-relaxed">{alignmentStatus.detail}</span> : null}
        </div>
      ) : null}
      <RenderCacheStatus reel={reel} intent="captions" />

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
          const missing = gameplayMissingTtsSegmentCount(reel);
          const freeComposite = canCompositeOnlyRerender(reel);
          const cost = describeRenderCost(reel, "captions");
          requestConfirm({
            title: costsCredits
              ? "Apply captions & re-render (TTS)?"
              : "Apply captions & re-render?",
            body: freeComposite
              ? reel.strategy === "gameplay_overlay"
                ? "Reuses cached narration and rebuilds captions over gameplay."
                : "Re-burns captions from the cached assembly (skips Ken Burns). No OpenRouter spend."
              : costsCredits
                ? `Uncached narration segments will spend OpenRouter TTS (~${missing} segment(s)), then captions are rebuilt.`
                : "Re-burns captions onto the existing video. Narration and images are reused.",
            details: freeComposite
              ? ["No OpenRouter image/TTS spend."]
              : costsCredits
                ? [
                    `About ${missing} narration segment(s) may be charged.`,
                    "After this run, later caption edits can stay free.",
                  ]
                : ["No OpenRouter image/TTS spend when narration/images already exist."],
            confirmLabel: costsCredits
              ? `Spend credits (~${missing} TTS) & apply`
              : "Apply & re-render · free",
            costTone: cost.tone,
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
          ? gameplayRerenderCostsCredits(reel)
            ? `Apply captions · ~${gameplayMissingTtsSegmentCount(reel)} TTS`
            : canCompositeOnlyRerender(reel)
              ? "Apply captions · free"
              : "Apply captions & re-render"
          : "Apply captions"}
      </Button>
    </div>
  );
}
