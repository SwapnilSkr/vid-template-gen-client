import { Play } from "lucide-react";
import type { Reel } from "@/api/reels";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { useReelStudio } from "@/store/reel-studio";
import { cn } from "@/lib/utils";
import { formatLabel, reelId } from "@/utils/reel";

interface RecentReelsListProps {
  selectedId?: string;
  reels?: Reel[];
  title?: string;
}

export function RecentReelsList({ selectedId, reels: reelsProp, title }: RecentReelsListProps) {
  const storeReels = useReelStudio((state) => state.reels);
  const select = useReelStudio((state) => state.select);
  const reels = reelsProp ?? storeReels;

  return (
    <Panel className="overflow-hidden">
      <PanelHeader>
        <PanelTitle>
          {title ?? "Recent Reels in Review"} ({reels.length})
        </PanelTitle>
      </PanelHeader>

      <div className="grid">
        <div className="hidden min-h-10 grid-cols-[minmax(170px,1.5fr)_minmax(120px,0.9fr)_92px_100px_64px] items-center gap-2.5 border-b border-border/60 bg-muted px-3.5 py-2 text-[11px] font-extrabold text-muted-foreground md:grid">
          <span>Title</span>
          <span>Genre</span>
          <span>Source</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {reels.map((reel) => {
          const id = reelId(reel);
          return (
            <button
              type="button"
              key={id}
              className={cn(
                "grid min-h-10 w-full grid-cols-1 items-center gap-1 border-0 border-b border-border/60 bg-card px-3.5 py-2 text-left text-xs font-semibold md:grid-cols-[minmax(170px,1.5fr)_minmax(120px,0.9fr)_92px_100px_64px] md:gap-2.5",
                selectedId === id && "bg-primary/5"
              )}
              onClick={() => void select(id)}
            >
              <span className="min-w-0 truncate">{reel.title || reel.topic || "Untitled reel"}</span>
              <span className="min-w-0 truncate">{formatLabel(reel.genre)}</span>
              <span className="min-w-0 truncate">{reel.storySource ?? reel.source ?? "auto"}</span>
              <span>
                <em
                  className={cn(
                    "inline-flex rounded-full bg-warning px-2 py-1 text-[11px] not-italic text-warning-foreground",
                    reel.status === "completed" && "bg-success/20 text-success-foreground"
                  )}
                >
                  {reel.status}
                </em>
              </span>
              <span>
                <Play size={15} />
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
