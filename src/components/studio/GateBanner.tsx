import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import type { Reel } from "@/api/reels";
import { OutroIncludeToggles } from "@/components/studio/panels/OutroIncludeToggles";
import type { ConfirmAction, StudioRun } from "@/components/studio/types";
import { Button } from "@/components/ui/button";

export function GateBanner({
  reel,
  busy,
  run,
  requestConfirm,
  onApprove,
}: {
  reel: Reel;
  busy: boolean;
  run: StudioRun;
  requestConfirm: (action: ConfirmAction) => void;
  onApprove: () => void;
}) {
  if (reel.status !== "plan_review") return null;
  return (
    <div className="mb-3 grid gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles size={18} className="shrink-0 text-warning" />
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

      <div className="grid gap-1.5 border-t border-warning/25 pt-3">
        <div className="text-xs font-medium text-foreground">
          End segments for this generate
        </div>
        <p className="m-0 text-[11px] text-muted-foreground">
          Include either, both, or neither. Free now — applied when you generate.
        </p>
        <OutroIncludeToggles
          reel={reel}
          busy={busy}
          run={run}
          requestConfirm={requestConfirm}
          compact
        />
      </div>
    </div>
  );
}
