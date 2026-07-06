import { Download, Loader2 } from "lucide-react";
import { memo } from "react";
import type { YoutubeSearchResult } from "@/api/yt-imports";
import { Button } from "@/components/ui/button";
import { panelClassName } from "@/components/ui/panel";
import { formatDuration, formatViews } from "@/components/youtube/format";
import { cn } from "@/lib/utils";

interface YoutubeSearchResultCardProps {
  video: YoutubeSearchResult;
  downloading: boolean;
  onDownload: (video: YoutubeSearchResult) => void;
}

export const YoutubeSearchResultCard = memo(function YoutubeSearchResultCard({
  video,
  downloading,
  onDownload,
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
        <Button
          className="mt-2"
          variant="default"
          disabled={downloading}
          onClick={() => onDownload(video)}
        >
          {downloading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
          Download
        </Button>
      </div>
    </article>
  );
});
