import { AlertCircle, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ConfirmAction, StudioActionResult } from "@/components/studio/types";
import { CostChip } from "@/components/reels/RenderCostHint";
import { Button } from "@/components/ui/button";

export function ConfirmModal({
  action,
  busy,
  onClose,
}: {
  action?: ConfirmAction;
  busy: boolean;
  onClose: () => void;
}) {
  const [confirmError, setConfirmError] = useState<string>();
  const [seriesChoice, setSeriesChoice] = useState<"manual" | "recommended">("manual");
  useEffect(() => {
    setSeriesChoice("manual");
    setConfirmError(undefined);
  }, [action]);
  if (!action) return null;
  const dismiss = () => {
    action.onCancel?.();
    onClose();
  };
  const confirm = async () => {
    setConfirmError(undefined);
    const result = await action.onConfirm(action.seriesStructure ? seriesChoice : undefined);
    if (isFailedStudioAction(result)) {
      setConfirmError(result.error ?? "This action could not be completed.");
      return;
    }
    onClose();
  };
  const costLabel =
    action.costTone === "free"
      ? "Free · no OpenRouter spend"
      : action.costTone === "paid"
        ? "Uses OpenRouter credits"
        : action.costTone === "warm"
          ? "Local compute only"
          : undefined;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/45 px-4">
      <div className="grid w-full max-w-md gap-3 rounded-lg border border-border bg-card p-4 shadow-pop">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1.5">
            {costLabel && action.costTone ? (
              <CostChip label={costLabel} tone={action.costTone} />
            ) : null}
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
            onClick={dismiss}
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
        {action.seriesStructure ? (
          <section className="grid gap-2 rounded-md border border-primary/30 bg-primary/[0.045] p-3">
            <div className="grid gap-0.5">
              <span className="text-xs font-semibold text-foreground">AI series recommendation</span>
              <span className="text-[11px] leading-relaxed text-muted-foreground">
                {action.seriesStructure.recommendedParts} {action.seriesStructure.recommendedParts === 1 ? "reel" : "parts"} recommended for {action.seriesStructure.wordCount} words · about {Math.ceil(action.seriesStructure.estimatedDurationSeconds / 60)} min total.
              </span>
            </div>
            <p className="m-0 text-xs leading-relaxed text-muted-foreground">{action.seriesStructure.reason}</p>
            {action.seriesStructure.hasWeakBreaks ? <p className="m-0 text-[11px] leading-relaxed text-warning">One or more suggested episode breaks is length-driven rather than a strong cliffhanger.</p> : null}
            <div role="radiogroup" aria-label="Series structure decision" className="grid gap-1.5">
              <button type="button" role="radio" aria-checked={seriesChoice === "manual"} disabled={busy} onClick={() => setSeriesChoice("manual")} className={`grid cursor-pointer gap-0.5 rounded border px-2.5 py-2 text-left transition-colors ${seriesChoice === "manual" ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"}`}>
                <span className="text-xs font-semibold text-foreground">Keep current plan · {action.seriesStructure.currentParts} {action.seriesStructure.currentParts === 1 ? "reel" : "parts"}</span>
                <span className="text-[11px] text-muted-foreground">Generate the story exactly as you currently structured it.</span>
              </button>
              <button type="button" role="radio" aria-checked={seriesChoice === "recommended"} disabled={busy} onClick={() => setSeriesChoice("recommended")} className={`grid cursor-pointer gap-0.5 rounded border px-2.5 py-2 text-left transition-colors ${seriesChoice === "recommended" ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"}`}>
                <span className="text-xs font-semibold text-foreground">Use AI recommendation · {action.seriesStructure.recommendedParts} {action.seriesStructure.recommendedParts === 1 ? "reel" : "parts"}</span>
                <span className="text-[11px] text-muted-foreground">Re-plans the episodes first when this differs from the current structure, then generates this reel.</span>
              </button>
            </div>
          </section>
        ) : null}
        {confirmError ? (
          <div role="alert" className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs leading-relaxed text-destructive">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{confirmError}</span>
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={dismiss}
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
            {action.seriesStructure ? "Generate with selected plan" : action.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function isFailedStudioAction(
  value: void | StudioActionResult,
): value is StudioActionResult {
  return Boolean(value && !value.ok);
}
