import { Check, Download, Gamepad2, Loader2, Plus } from "lucide-react";
import { memo } from "react";
import type { YoutubeSearchResult } from "@/api/yt-imports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { panelClassName } from "@/components/ui/panel";
import { formatDuration, formatViews } from "@/components/youtube/format";
import { cn } from "@/lib/utils";

interface YoutubeSearchResultCardProps {
  video: YoutubeSearchResult;
  downloading: boolean;
  addingAsGameplay: boolean;
  selectedForMix: boolean;
  gameplayTrim: { startSec: string; endSec: string };
  onDownload: (video: YoutubeSearchResult) => void;
  onAddAsGameplay: (video: YoutubeSearchResult) => void;
  onToggleMixSelection: (video: YoutubeSearchResult) => void;
  onGameplayTrimChange: (video: YoutubeSearchResult, next: { startSec: string; endSec: string }) => void;
}

export const YoutubeSearchResultCard = memo(function YoutubeSearchResultCard({
  video,
  downloading,
  addingAsGameplay,
  selectedForMix,
  gameplayTrim,
  onDownload,
  onAddAsGameplay,
  onToggleMixSelection,
  onGameplayTrimChange,
}: YoutubeSearchResultCardProps) {
  return (
    <article className={cn(panelClassName, "flex gap-3 p-3")}>
      {video.thumbnailUrl ? (
        <img
          src={video.thumbnailUrl}
          alt=""
          className="h-20 w-36 shrink-0 rounded-md object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="h-20 w-36 shrink-0 rounded-md bg-muted" />
      )}
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-sm font-medium text-foreground">{video.title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {video.channelTitle}
          {video.durationSec ? ` · ${formatDuration(video.durationSec)}` : ""}
          {video.viewCount ? ` · ${formatViews(video.viewCount)}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="default" disabled={downloading || addingAsGameplay} onClick={() => onDownload(video)}>
          {downloading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
          Download
        </Button>
        <Button variant="secondary" disabled={downloading || addingAsGameplay} onClick={() => onAddAsGameplay(video)}>
          {addingAsGameplay ? <Loader2 className="animate-spin" size={16} /> : <Gamepad2 size={16} />}
          Add as gameplay
        </Button>
        <Button variant={selectedForMix ? "default" : "outline"} disabled={downloading || addingAsGameplay} onClick={() => onToggleMixSelection(video)}>
          {selectedForMix ? <Check size={16} /> : <Plus size={16} />}
          {selectedForMix ? "In gameplay mix" : "Add to mix"}
        </Button>
        </div>
        <div className="mt-2 grid max-w-sm grid-cols-2 gap-2">
          <label className="grid gap-1 text-[11px] text-muted-foreground">
            Gameplay in (seconds)
            <Input type="number" min="0" max={video.durationSec} step="0.1" value={gameplayTrim.startSec} onChange={(event) => onGameplayTrimChange(video, { ...gameplayTrim, startSec: event.target.value })} />
          </label>
          <label className="grid gap-1 text-[11px] text-muted-foreground">
            Gameplay out (blank = end)
            <Input type="number" min="0" max={video.durationSec} step="0.1" value={gameplayTrim.endSec} onChange={(event) => onGameplayTrimChange(video, { ...gameplayTrim, endSec: event.target.value })} />
          </label>
        </div>
      </div>
    </article>
  );
});
