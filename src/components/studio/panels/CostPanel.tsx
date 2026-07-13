import { Receipt } from "lucide-react";
import type { Reel } from "@/api/reels";
import { PanelTitle } from "@/components/ui/panel";
import { sanitizeAiCostBreakdown } from "@/utils/reel-cost";

const reelKey = (r: Reel) => r._id ?? r.id;

export function CostPanel({ reel, seriesReels = [] }: { reel: Reel; seriesReels?: Reel[] }) {
  const breakdown = sanitizeAiCostBreakdown(reel.costBreakdown);
  // A part's story/plan spend is recorded once on part 1, produce spend on each
  // part — so a single reel's ledger never reflects the whole series. Sum every
  // part's sanitized total for a true series figure.
  const parts = seriesReels.length ? seriesReels : [reel];
  const seriesTotal = parts.reduce(
    (sum, part) => sum + (sanitizeAiCostBreakdown(part.costBreakdown)?.totalUsd ?? 0),
    0,
  );
  const isSeries = parts.length > 1 && parts.some((part) => reelKey(part) !== reelKey(reel));
  const seriesTotalRow = isSeries ? (
    <div className="flex items-baseline justify-between border-t border-border/70 pt-2 text-sm">
      <span className="font-medium text-foreground">
        Series total <span className="text-muted-foreground/70">({parts.length} parts)</span>
      </span>
      <span className="font-semibold tabular-nums text-primary">${seriesTotal.toFixed(4)}</span>
    </div>
  ) : null;

  if (!breakdown?.lines?.length) {
    return (
      <div className="grid gap-2">
        <PanelTitle className="inline-flex items-center gap-2 text-foreground">
          <Receipt size={15} className="text-primary" /> Cost breakdown
        </PanelTitle>
        <p className="m-0 text-[11px] text-muted-foreground/80">
          {isSeries && seriesTotal > 0
            ? "No spend on this part yet — story/plan cost is recorded on Part 1."
            : "No spend recorded yet. Produce and re-render jobs append OpenRouter usage here when they finish."}
        </p>
        {seriesTotalRow}
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <PanelTitle className="inline-flex items-center gap-2 text-foreground">
        <Receipt size={15} className="text-primary" /> Cost breakdown
      </PanelTitle>
      <div className="grid gap-1">
        {breakdown.lines.map((line, index) => (
          <div
            key={`${index}-${line.label}-${line.model ?? ""}`}
            className="flex items-baseline justify-between gap-3 text-xs"
          >
            <span className="min-w-0 truncate text-muted-foreground">
              {line.label}
              {line.model ? <span className="text-muted-foreground/60"> · {line.model}</span> : null}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-foreground">
              ${line.costUsd.toFixed(4)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-baseline justify-between border-t border-border/70 pt-2 text-sm">
        <span className="font-medium text-foreground">{isSeries ? "This part" : "Total"}</span>
        <span className="font-semibold tabular-nums text-primary">${breakdown.totalUsd.toFixed(4)}</span>
      </div>
      {seriesTotalRow}
      <p className="m-0 text-[11px] text-muted-foreground/80">
        {breakdown.note ??
          "Re-renders append new lines (prefixed [Re-render]) so totals accumulate."}
      </p>
    </div>
  );
}

