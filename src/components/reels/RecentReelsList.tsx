import { Play, Trash2 } from "lucide-react";
import type { Reel } from "@/api/reels";
import { Button } from "@/components/ui/button";
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
  const deleteById = useReelStudio((state) => state.deleteById);
  const loading = useReelStudio((state) => state.loading);
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
          <span>Mode</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {reels.map((reel) => {
          const id = reelId(reel);
          return (
            <div
              key={id}
              className={cn(
                "grid min-h-10 w-full grid-cols-1 items-center gap-1 border-0 border-b border-border/60 bg-card px-3.5 py-2 text-left text-xs font-semibold md:grid-cols-[minmax(170px,1.5fr)_minmax(120px,0.9fr)_92px_100px_64px] md:gap-2.5",
                selectedId === id && "bg-primary/5"
              )}
            >
              <button
                type="button"
                className="min-w-0 border-0 bg-transparent p-0 text-left text-xs font-semibold text-foreground"
                onClick={() => void select(id)}
              >
                <span className="block truncate">{reel.title || reel.topic || "Untitled reel"}</span>
              </button>
              <button
                type="button"
                className="min-w-0 border-0 bg-transparent p-0 text-left text-xs font-semibold text-foreground"
                onClick={() => void select(id)}
              >
                <span className="block truncate">{formatLabel(reel.genre)}</span>
              </button>
              <button
                type="button"
                className="min-w-0 border-0 bg-transparent p-0 text-left text-xs font-semibold text-foreground"
                onClick={() => void select(id)}
              >
                <span className="block truncate">
                  {(reel.partCount ?? 1) > 1
                    ? `Part ${reel.partNumber ?? 1}/${reel.partCount}`
                    : reel.niche.startsWith("horror")
                      ? "Standalone"
                      : reel.storySource ?? reel.source ?? "auto"}
                </span>
              </button>
              <button
                type="button"
                className="border-0 bg-transparent p-0 text-left"
                onClick={() => void select(id)}
              >
                <em
                  className={cn(
                    "inline-flex rounded-full bg-warning px-2 py-1 text-[11px] not-italic text-warning-foreground",
                    reel.status === "completed" && "bg-success/20 text-success-foreground",
                    reel.status === "failed" && "bg-destructive/15 text-destructive"
                  )}
                >
                  {reel.status}
                </em>
              </button>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" title="Open reel" onClick={() => void select(id)}>
                  <Play size={15} />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  title="Delete reel and its S3 assets"
                  disabled={loading}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    const ok = window.confirm(
                      "Delete this reel and its recorded S3 assets? Global gameplay clips and voice samples will not be touched."
                    );
                    if (ok) void deleteById(id);
                  }}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
