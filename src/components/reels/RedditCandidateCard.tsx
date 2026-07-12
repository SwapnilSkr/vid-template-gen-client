import { ExternalLink, MessageSquare, ThumbsUp } from "lucide-react";
import type { RedditCandidate } from "@/api/stories";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatAgeHours(hours: number): string {
  if (hours < 1) return "<1h";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

export function RedditCandidateCard({
  candidate,
  selected,
  disabled,
  showSeriesHint,
  onSelect,
}: {
  candidate: RedditCandidate;
  selected: boolean;
  disabled?: boolean;
  showSeriesHint?: boolean;
  onSelect: () => void;
}) {
  const unavailable = candidate.unavailable || disabled;
  const subreddit = candidate.subreddit.startsWith("r/")
    ? candidate.subreddit
    : `r/${candidate.subreddit}`;

  return (
    <article
      className={cn(
        "grid gap-2 rounded-lg border p-3 transition-colors [content-visibility:auto] [contain-intrinsic-size:0_140px]",
        selected ? "border-primary bg-primary/5" : "border-border bg-card",
        unavailable && "opacity-60"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-muted-foreground">
        <span className="text-foreground">{subreddit}</span>
        <span>·</span>
        <span>u/{candidate.author.replace(/^u\//, "")}</span>
        <span>·</span>
        <span>{formatAgeHours(candidate.ageHours)}</span>
      </div>

      <h3 className="m-0 text-sm font-semibold leading-snug text-foreground">{candidate.title}</h3>
      <p className="m-0 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{candidate.excerpt}</p>

      <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <ThumbsUp size={12} />
          {formatCount(candidate.upvotes)}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare size={12} />
          {formatCount(candidate.comments)}
        </span>
        <span>{candidate.wordCount.toLocaleString()} words</span>
        {showSeriesHint && candidate.estimatedParts && candidate.estimatedParts > 1 ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-foreground">
            ~{candidate.estimatedParts} parts
          </span>
        ) : null}
      </div>

      {candidate.unavailable && candidate.unavailableReason ? (
        <p className="m-0 text-[11px] font-medium text-warning-foreground">{candidate.unavailableReason}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={selected ? "default" : "outline"}
          disabled={unavailable}
          onClick={onSelect}
        >
          {selected ? "Selected" : "Select"}
        </Button>
        <a
          href={candidate.seedUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary no-underline hover:underline"
        >
          Open on Reddit <ExternalLink size={12} />
        </a>
      </div>
    </article>
  );
}
