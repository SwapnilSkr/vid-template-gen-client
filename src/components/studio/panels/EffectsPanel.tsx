import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import {
  regenerateReel,
  updateReelSettings,
  type EditEffects,
  type Reel,
} from "@/api/reels";
import { EditEffectsControls } from "@/components/reels/EditEffectsControls";
import { CostChip, RenderCacheStatus, describeRenderCost } from "@/components/reels/RenderCostHint";
import type { ConfirmAction, StudioRun } from "@/components/studio/types";
import { Button } from "@/components/ui/button";
import { PanelTitle } from "@/components/ui/panel";
import { canCompositeOnlyRerender } from "@/utils/reel";

export function EffectsPanel({
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
      <RenderCacheStatus reel={reel} intent="effects" />
      <EditEffectsControls value={fx} onChange={setFx} disabled={busy} />
      <Button
        type="button"
        variant="default"
        disabled={busy}
        onClick={() => {
          const cost = describeRenderCost(reel, "effects");
          requestConfirm({
            title: "Apply effects & re-render?",
            body: cost.detail,
            details: [
              cost.tone === "free"
                ? "Uses the cached assembly — no scene re-assembly."
                : "First bake builds the assembly cache for later free FX passes.",
              "A job already in progress cannot be stacked.",
            ],
            confirmLabel: cost.tone === "free" ? "Apply · free" : "Apply & rebuild",
            costTone: cost.tone,
            onConfirm: () =>
              run(async () => {
                await updateReelSettings(reelKey, { editEffects: fx });
                return regenerateReel(
                  reelKey,
                  canCompositeOnlyRerender(reel) ? "composite_only" : "render_only"
                );
              }),
          });
        }}
      >
        <RefreshCw size={15} />{" "}
        {canCompositeOnlyRerender(reel) ? "Apply & re-render · free" : "Apply & re-render"}
      </Button>
      <p className="text-[11px] text-muted-foreground/80">
        Cinematic finish over the reel body. Never spends image/TTS credits — only
        local ffmpeg (and a one-time assembly build if the cache is empty).
      </p>
    </div>
  );
}

