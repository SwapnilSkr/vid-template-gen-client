import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Film,
  Loader2,
  MoreVertical,
} from "lucide-react";
import { mediaUrl, type Reel, type Scene } from "@/api/reels";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { useReelStudio } from "@/store/reel-studio";
import { formatLabel, reelId } from "@/utils/reel";
import { cn } from "@/lib/utils";

interface VideoPreviewProps {
  reel?: Reel;
  reels?: Reel[];
  selectedId?: string;
}

function reelOptionLabel(item: Reel, index: number) {
  const partLabel =
    (item.partCount ?? 1) > 1
      ? ` · Part ${item.partNumber ?? index + 1}/${item.partCount}`
      : "";
  return `${String(index + 1).padStart(2, "0")} · ${item.title || item.topic || "Untitled reel"} · ${formatLabel(item.genre)}${partLabel}`;
}



export function VideoPreview({
  reel,
  reels = [],
  selectedId,
}: VideoPreviewProps) {
  const setPreviewTimeSeconds = useReelStudio(
    (state) => state.setPreviewTimeSeconds,
  );
  const select = useReelStudio((state) => state.select);
  const selectedIndex = reels.findIndex((item) => reelId(item) === selectedId);
  const hasNavigator = reels.length > 1 && selectedIndex >= 0;
  const previousReel = hasNavigator ? reels[selectedIndex - 1] : undefined;
  const nextReel = hasNavigator ? reels[selectedIndex + 1] : undefined;




  return (
    <Panel className="grid h-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <PanelHeader>
        <div className="min-w-0 truncate pr-4">
          <span className="text-sm font-semibold tracking-normal text-foreground">
            {reel ? (reel.title || reel.topic || "Untitled reel") : "No reel selected"}
          </span>
        </div>
        <div className="flex items-center justify-end gap-1 shrink-0">
          {hasNavigator ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Previous reel"
                disabled={!previousReel}
                onClick={() =>
                  previousReel && void select(reelId(previousReel))
                }
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Next reel"
                disabled={!nextReel}
                onClick={() => nextReel && void select(reelId(nextReel))}
              >
                <ChevronRight size={16} />
              </Button>
            </>
          ) : null}
        </div>
      </PanelHeader>

      <div className="m-3 flex min-h-60 items-center justify-center rounded-lg border border-border/30 bg-black/25 p-3 md:min-h-[300px]">
        <div className={cn(
          "aspect-9/16 h-[min(460px,52vh)] w-auto max-w-full overflow-hidden rounded-lg border border-border/30 bg-black transition-all duration-300",
          reel && !reel.outputUrl && "bg-gradient-to-b from-zinc-950 via-zinc-900/50 to-zinc-950 shadow-[0_0_20px_rgba(97,110,216,0.15)] border-indigo-500/20"
        )}>
          {reel?.outputUrl ? (
            <video
              className="h-full w-full object-contain"
              key={reel.outputUrl}
              src={reel.outputUrl}
              controls
              autoPlay
              playsInline
              onLoadedMetadata={(event) =>
                setPreviewTimeSeconds(event.currentTarget.currentTime)
              }
              onSeeked={(event) =>
                setPreviewTimeSeconds(event.currentTarget.currentTime)
              }
              onTimeUpdate={(event) =>
                setPreviewTimeSeconds(event.currentTarget.currentTime)
              }
            />
          ) : reel ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="relative flex h-14 w-14 items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/10" />
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                <Film className="h-6 w-6 text-indigo-400 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-foreground tracking-tight">
                  Generating Reel
                </h3>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400 shadow-sm border border-indigo-500/20 animate-pulse">
                  {reel.progress}% completed
                </div>
                <p className="max-w-[180px] text-xs text-muted-foreground leading-normal mt-1">
                  Writing script, synthesizing audio, and rendering assets...
                </p>
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center gap-2 px-4 text-center text-muted-foreground">
              <Film size={40} className="text-zinc-600" />
              <strong className="text-sm font-semibold text-foreground/80">
                Select or create a reel
              </strong>
              <span className="text-xs text-muted-foreground/80 max-w-[200px]">
                Completed reels will appear here for review and styling.
              </span>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
