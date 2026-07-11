import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import type { Reel } from "@/api/reels";
import { Button } from "@/components/ui/button";

export function GateBanner({
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

