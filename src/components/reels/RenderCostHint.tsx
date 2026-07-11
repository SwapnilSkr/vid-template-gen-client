import type { Reel } from "@/api/reels";
import { cn } from "@/lib/utils";
import {
  canCompositeOnlyRerender,
  canOutroOnlyRerender,
  gameplayMissingTtsSegmentCount,
  gameplayNarrationCacheReady,
} from "@/utils/reel";

type CostTone = "free" | "paid" | "warm";

function toneClasses(tone: CostTone): string {
  if (tone === "free") return "border-success/40 bg-success/10 text-success";
  if (tone === "paid") return "border-warning/45 bg-warning/12 text-warning";
  return "border-border bg-muted/40 text-muted-foreground";
}

/** Small pill for a single cache / cost fact. */
export function CostChip({
  label,
  tone = "warm",
  className,
}: {
  label: string;
  tone?: CostTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none",
        toneClasses(tone),
        className,
      )}
    >
      {label}
    </span>
  );
}

export type RenderIntent = "composite" | "outro" | "captions" | "effects" | "full";

/** Human summary of what the next bake will spend for this intent. */
export function describeRenderCost(
  reel: Reel,
  intent: RenderIntent
): { tone: CostTone; headline: string; detail: string } {
  const isGameplay = reel.strategy === "gameplay_overlay";
  const missing = gameplayMissingTtsSegmentCount(reel);

  if (intent === "outro") {
    if (canOutroOnlyRerender(reel)) {
      return {
        tone: "free",
        headline: "Outro-only · free body rebuild",
        detail: reel.outroAudioUrl
          ? "Cached body + outro audio ready. TTS only if the spoken line or brand changes."
          : "Cached body ready. Only the outro clip is rebuilt (small TTS if the spoken line is new).",
      };
    }
    if (isGameplay && missing > 0) {
      return {
        tone: "paid",
        headline: `Full rebuild · ~${missing} TTS segment${missing === 1 ? "" : "s"}`,
        detail: "No body cache yet. One bake populates caches; later outro edits stay cheap.",
      };
    }
    return {
      tone: "warm",
      headline: "Full rebuild · assets reused",
      detail: "Body cache missing. Stills/narration are reused; the reel is re-assembled once.",
    };
  }

  if (intent === "composite" || intent === "captions" || intent === "effects") {
    if (canCompositeOnlyRerender(reel) || (intent === "effects" && Boolean(reel.assemblyVideoUrl))) {
      return {
        tone: "free",
        headline: isGameplay ? "Composite · free (narration cached)" : "Assembly pass · free (no Ken Burns)",
        detail: isGameplay
          ? "Title and sentence audio are cached. Only the video composite is rebuilt."
          : "Pre-caption assembly is cached. Captions/effects re-burn without re-assembling scenes.",
      };
    }
    if (isGameplay && missing > 0) {
      return {
        tone: "paid",
        headline: `Needs cache · ~${missing} TTS segment${missing === 1 ? "" : "s"}`,
        detail: "First bake stores narration. After that, caption and card edits are free.",
      };
    }
    return {
      tone: "warm",
      headline: "Rebuild · assets reused",
      detail: "No assembly cache yet. Scene stills and narration are reused; compute only.",
    };
  }

  // full re-render
  if (isGameplay && missing > 0) {
    return {
      tone: "paid",
      headline: `Re-render · ~${missing} TTS segment${missing === 1 ? "" : "s"}`,
      detail: "Missing narration will be generated, then cached for later free composites.",
    };
  }
  return {
    tone: "free",
    headline: isGameplay ? "Re-render · free (narration cached)" : "Re-render · free (assets cached)",
    detail: "OpenRouter image/TTS spend is skipped. Local ffmpeg only.",
  };
}

/** Cache readiness strip shown above Studio bake actions. */
export function RenderCacheStatus({
  reel,
  intent,
  className,
}: {
  reel: Reel;
  intent?: RenderIntent;
  className?: string;
}) {
  const isGameplay = reel.strategy === "gameplay_overlay";
  const narrationReady = gameplayNarrationCacheReady(reel);
  const missing = gameplayMissingTtsSegmentCount(reel);
  const cost = intent ? describeRenderCost(reel, intent) : undefined;

  const chips: { label: string; tone: CostTone }[] = [];
  if (isGameplay) {
    chips.push(
      narrationReady
        ? { label: "Narration cached", tone: "free" }
        : { label: missing > 0 ? `${missing} TTS missing` : "Narration incomplete", tone: "paid" }
    );
  } else {
    chips.push(
      reel.assemblyVideoUrl
        ? { label: "Assembly cached", tone: "free" }
        : { label: "No assembly cache", tone: "warm" }
    );
  }
  chips.push(
    reel.bodyVideoUrl
      ? { label: "Body (pre-outro) cached", tone: "free" }
      : { label: "No body cache", tone: "warm" }
  );
  if (reel.outroAudioUrl) {
    chips.push({ label: "Outro audio cached", tone: "free" });
  }

  return (
    <div
      className={cn(
        "grid gap-2 rounded-md border border-border bg-background/80 px-2.5 py-2",
        className
      )}
    >
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <CostChip key={chip.label} label={chip.label} tone={chip.tone} />
        ))}
      </div>
      {cost ? (
        <div className="grid gap-0.5">
          <div className="flex items-center gap-2">
            <CostChip
              label={cost.tone === "free" ? "Free" : cost.tone === "paid" ? "Credits" : "Compute"}
              tone={cost.tone}
            />
            <span className="text-[11px] font-medium text-foreground">{cost.headline}</span>
          </div>
          <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">{cost.detail}</p>
        </div>
      ) : null}
    </div>
  );
}
