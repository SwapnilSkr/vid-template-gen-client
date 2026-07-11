import { Loader2, RefreshCw, Wand2 } from "lucide-react";
import {
  regenerateReel,
  resumeFailedReel,
  type Reel,
} from "@/api/reels";
import { CostChip, RenderCacheStatus, describeRenderCost } from "@/components/reels/RenderCostHint";
import type { ConfirmAction, StudioRun } from "@/components/studio/types";
import { Button } from "@/components/ui/button";
import { PanelTitle } from "@/components/ui/panel";
import {
  canCompositeOnlyRerender,
  canOutroOnlyRerender,
  gameplayMissingTtsSegmentCount,
  gameplayNarrationCacheReady,
  gameplayRerenderCostsCredits,
} from "@/utils/reel";

export function RegeneratePanel({
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
  const fullCost = describeRenderCost(reel, "full");
  return (
    <div className="grid gap-2.5">
      <PanelTitle className="text-foreground">Render Queue</PanelTitle>
      <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
        Edits are free until you bake. Caches below decide whether a bake spends
        credits or only local compute.
      </p>
      <RenderCacheStatus reel={reel} intent="full" />
      {isFailed ? (
        <Button
          type="button"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={busy}
          onClick={() =>
            requestConfirm({
              title: "Resume failed job?",
              body: fullCost.detail,
              details: costsCredits
                ? [
                    `About ${gameplayMissingTtsSegmentCount(reel)} narration segment(s) may be charged.`,
                    "Spend is added to this reel's cost breakdown when the job finishes.",
                  ]
                : ["No new image/TTS spend if assets are already on S3."],
              confirmLabel: costsCredits ? "Resume · spend credits" : "Resume · free",
              costTone: fullCost.tone,
              onConfirm: () => run(() => resumeFailedReel(reelKey), { requireFfmpeg: true }),
            })
          }
        >
          <RefreshCw size={15} />{" "}
          {costsCredits ? "Resume failed job · credits" : "Resume failed job · free"}
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
              body: fullCost.detail,
              details: costsCredits
                ? [
                    `About ${gameplayMissingTtsSegmentCount(reel)} narration segment(s) may be charged.`,
                    "After this run, caption/card/outro edits can stay free.",
                  ]
                : [
                    "OpenRouter image/TTS spend is skipped.",
                    "A job already in progress cannot be stacked.",
                  ],
              confirmLabel: costsCredits
                ? `Spend credits (~${gameplayMissingTtsSegmentCount(reel)} TTS)`
                : "Re-render · free",
              costTone: fullCost.tone,
              onConfirm: () =>
                run(
                  () =>
                    regenerateReel(
                      reelKey,
                      canCompositeOnlyRerender(reel) ? "composite_only" : "render_only"
                    ),
                  { requireFfmpeg: true }
                ),
            })
          }
        >
          <RefreshCw size={15} />{" "}
          {costsCredits
            ? `Re-render · ~${gameplayMissingTtsSegmentCount(reel)} TTS`
            : isGameplay
              ? "Re-render · free (narration cached)"
              : canCompositeOnlyRerender(reel)
                ? "Re-render · free (assembly cached)"
                : "Re-render · free (assets cached)"}
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

