import { MessageSquare, ThumbsUp } from "lucide-react";
import type { StoryBankItem } from "@/api/stories";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatLabel } from "@/utils/reel";

function formatCount(value?: number): string {
  if (value === undefined) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function formatBankAge(createdAt: string): string {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return "";
  const hours = Math.max(0, Math.round((Date.now() - created) / (1000 * 60 * 60)));
  if (hours < 1) return "banked <1h ago";
  if (hours < 24) return `banked ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `banked ${days}d ago`;
}

export function StoryBankCard({
  item,
  selected,
  disabled,
  showSeriesHint,
  onSelect,
}: {
  item: StoryBankItem;
  selected: boolean;
  disabled?: boolean;
  showSeriesHint?: boolean;
  onSelect: () => void;
}) {
  const unavailable = item.unavailable || disabled;

  return (
    <article
      className={cn(
        "grid gap-2 rounded-lg border p-3 transition-colors [content-visibility:auto] [contain-intrinsic-size:0_120px]",
        selected ? "border-primary bg-primary/5" : "border-border bg-card",
        unavailable && "opacity-60"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-0.5 text-foreground">{item.source}</span>
        {item.genre ? <span>{formatLabel(item.genre)}</span> : null}
        {item.subreddit ? (
          <>
            <span>·</span>
            <span>{item.subreddit.startsWith("r/") ? item.subreddit : `r/${item.subreddit}`}</span>
          </>
        ) : null}
        <span>·</span>
        <span>{formatBankAge(item.createdAt)}</span>
      </div>

      <h3 className="m-0 text-sm font-semibold leading-snug text-foreground">{item.title}</h3>
      <p className="m-0 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{item.excerpt}</p>

      <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-muted-foreground">
        {item.upvotes !== undefined ? (
          <span className="inline-flex items-center gap-1">
            <ThumbsUp size={12} />
            {formatCount(item.upvotes)}
          </span>
        ) : null}
        {item.comments !== undefined ? (
          <span className="inline-flex items-center gap-1">
            <MessageSquare size={12} />
            {formatCount(item.comments)}
          </span>
        ) : null}
        {item.wordCount !== undefined ? <span>{item.wordCount.toLocaleString()} words</span> : null}
        {showSeriesHint && item.estimatedParts && item.estimatedParts > 1 ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-foreground">
            ~{item.estimatedParts} parts
          </span>
        ) : null}
      </div>

      {item.unavailable && item.unavailableReason ? (
        <p className="m-0 text-[11px] font-medium text-warning-foreground">{item.unavailableReason}</p>
      ) : null}

      <Button
        type="button"
        size="sm"
        variant={selected ? "default" : "outline"}
        disabled={unavailable}
        onClick={onSelect}
        className="w-fit"
      >
        {selected ? "Selected" : "Select"}
      </Button>
    </article>
  );
}
