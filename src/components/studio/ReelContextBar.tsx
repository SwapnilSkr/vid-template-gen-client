import { Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { type Reel } from "@/api/reels";
import { ReelStatusChip } from "@/components/reels/ReelStatusChip";
import { buttonClassName } from "@/components/ui/button";
import { reelKey } from "@/components/studio/utils";
import { cn } from "@/lib/utils";

export function ReelContextBar({
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
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs">
        <span className="font-semibold text-foreground">Standalone reel</span>
        <span className="text-muted-foreground/80">
          Scenes, voice, captions, and render settings apply only to this reel.
        </span>
      </div>
    );
  }

  const parts = seriesReels.length ? seriesReels : [reel];
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
            <Link
              key={id || `${part.partNumber}`}
              to="/studio/$id"
              params={{ id }}
              className={cn(
                "grid min-w-0 gap-1 rounded-md border px-3 py-2 text-left text-xs no-underline",
                active
                  ? "border-primary/70 bg-primary/10"
                  : "border-border bg-card hover:bg-secondary",
              )}
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
          );
        })}
      </div>
    </div>
  );
}

