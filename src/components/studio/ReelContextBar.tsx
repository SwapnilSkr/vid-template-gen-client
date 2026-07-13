import { Link } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Merge,
  Trash2,
} from "lucide-react";
import { type Reel } from "@/api/reels";
import { ReelStatusChip } from "@/components/reels/ReelStatusChip";
import { buttonClassName } from "@/components/ui/button";
import { reelKey } from "@/components/studio/utils";
import { cn } from "@/lib/utils";

export function ReelContextBar({
  reel,
  seriesReels,
  currentId,
  onDeletePart,
  onMoveBoundary,
  onMergePart,
  partActionsDisabled,
}: {
  reel: Reel;
  seriesReels: Reel[];
  currentId: string;
  onDeletePart: (part: Reel) => void;
  onMoveBoundary: (direction: "pushLastToNext" | "pullFirstFromNext") => void;
  onMergePart: () => void;
  partActionsDisabled: boolean;
}) {
  const isSeries = Boolean(reel.seriesId && (reel.partCount ?? 1) > 1);
  if (!isSeries) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs">
        <span className="font-semibold text-foreground">Standalone reel</span>
        <span className="text-muted-foreground/80">
          Scenes, voice, captions, and render settings apply only to this reel.
        </span>
      </div>
    );
  }

  const parts = [...(seriesReels.length ? seriesReels : [reel])].sort(
    (a, b) => (a.partNumber ?? 1) - (b.partNumber ?? 1),
  );
  const currentIdx = parts.findIndex((part) => reelKey(part) === currentId);
  const nextPart = currentIdx >= 0 ? parts[currentIdx + 1] : undefined;
  const prevPart = currentIdx >= 0 ? parts[currentIdx - 1] : undefined;
  const currentNumber = reel.partNumber ?? currentIdx + 1;
  const currentLines = reel.scenes?.length ?? 0;
  const nextLines = nextPart?.scenes?.length ?? 0;
  const canPushLast = Boolean(nextPart) && currentLines > 1;
  const canPullFirst = Boolean(nextPart) && nextLines > 1;
  const pillClass =
    "inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40";
  return (
    <div className="grid gap-2 rounded-md border border-border bg-background px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs">
          <span className="font-semibold text-foreground">Series</span>
          <span className="ml-2 text-muted-foreground/80">
            Part {reel.partNumber ?? 1} of {reel.partCount ?? parts.length}
          </span>
        </div>
        <span className="text-[11px] font-medium text-muted-foreground/80">
          Edit and generate each part independently.
        </span>
      </div>
      <div className="grid min-w-0 gap-1.5">
        {parts.map((part) => {
          const id = reelKey(part);
          const active = id === currentId;
          return (
            <div
              key={id || `${part.partNumber}`}
              className={cn(
                "group relative grid grid-cols-[1fr_auto] items-center gap-1 rounded-md border pr-1 text-xs",
                active
                  ? "border-primary/70 bg-primary/10"
                  : "border-border bg-card hover:bg-secondary",
              )}
            >
              <Link
                to="/studio/$id"
                params={{ id }}
                className="grid min-w-0 gap-1 px-3 py-2 text-left no-underline"
              >
                <span className="font-semibold text-foreground">
                  Part {part.partNumber ?? 1}
                </span>
                <span className="truncate text-muted-foreground/80">
                  {part.title || part.topic || "Untitled"}
                </span>
                <ReelStatusChip
                  size="sm"
                  status={part.status}
                  label={part.status === "plan_review" ? "review" : undefined}
                />
              </Link>
              <button
                type="button"
                disabled={partActionsDisabled}
                title={`Delete Part ${part.partNumber ?? 1}`}
                aria-label={`Delete Part ${part.partNumber ?? 1}`}
                onClick={() => onDeletePart(part)}
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid gap-1.5 rounded-md border border-dashed border-border px-2.5 py-2">
        <span className="text-[11px] font-medium text-muted-foreground">
          Rebalance Part {currentNumber}
        </span>
        <div className="flex flex-wrap gap-1">
          {nextPart ? (
            <>
              <button
                type="button"
                disabled={partActionsDisabled || !canPushLast}
                title={
                  canPushLast
                    ? `Move this part's last line to Part ${currentNumber + 1}`
                    : "A part must keep at least one line"
                }
                onClick={() => onMoveBoundary("pushLastToNext")}
                className={pillClass}
              >
                <ArrowDownToLine size={12} /> Last line → P{currentNumber + 1}
              </button>
              <button
                type="button"
                disabled={partActionsDisabled || !canPullFirst}
                title={
                  canPullFirst
                    ? `Pull Part ${currentNumber + 1}'s first line into this part`
                    : "The next part must keep at least one line"
                }
                onClick={() => onMoveBoundary("pullFirstFromNext")}
                className={pillClass}
              >
                <ArrowUpToLine size={12} /> Pull ← P{currentNumber + 1}
              </button>
            </>
          ) : null}
          {prevPart ? (
            <button
              type="button"
              disabled={partActionsDisabled}
              title={`Merge this part into Part ${currentNumber - 1}`}
              onClick={onMergePart}
              className={pillClass}
            >
              <Merge size={12} /> Merge into P{currentNumber - 1}
            </button>
          ) : null}
        </div>
        <span className="text-[10px] text-muted-foreground/70">
          Move a line across the seam or consolidate parts — no re-plan, keeps your edits.
        </span>
      </div>
    </div>
  );
}

