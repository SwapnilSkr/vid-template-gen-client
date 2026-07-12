import { Loader2, RefreshCw } from "lucide-react";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import {
  listRedditCandidates,
  listStoryBank,
  type RedditCandidate,
  type StoryBankItem,
  type StorySource,
} from "@/api/stories";
import { RedditCandidateCard } from "@/components/reels/RedditCandidateCard";
import { StoryBankCard } from "@/components/reels/StoryBankCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FEED_PAGE_SIZE = 8;
const BANK_PAGE_SIZE = 20;

export type StorySelection =
  | { kind: "bank"; storyId: string }
  | { kind: "feed"; seedUrl: string };

type PickerTab = "feed" | "bank";

export interface StoryPickerStepProps {
  genre: string;
  source: StorySource;
  parts?: "off" | "auto" | number;
  selection: StorySelection | null;
  onSelect: (selection: StorySelection | null) => void;
  compact?: boolean;
}

function showSeriesHint(parts?: "off" | "auto" | number): boolean {
  return parts !== undefined && parts !== "off";
}

export function StoryPickerStep({
  genre,
  source,
  parts,
  selection,
  onSelect,
  compact = false,
}: StoryPickerStepProps) {
  const showFeedTab = source !== "llm";
  const [tab, setTab] = useState<PickerTab>(showFeedTab ? "feed" : "bank");
  const [feedItems, setFeedItems] = useState<RedditCandidate[]>([]);
  const [bankItems, setBankItems] = useState<StoryBankItem[]>([]);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [bankHasMore, setBankHasMore] = useState(false);
  const [bankTotal, setBankTotal] = useState(0);
  const [feedLoading, setFeedLoading] = useState(false);
  const [bankLoading, setBankLoading] = useState(false);
  const [feedError, setFeedError] = useState<string>();
  const [bankError, setBankError] = useState<string>();

  const seriesHint = showSeriesHint(parts);

  useEffect(() => {
    if (!showFeedTab && tab === "feed") {
      startTransition(() => setTab("bank"));
    }
  }, [showFeedTab, tab]);

  const excludeUrls = useMemo(
    () => feedItems.map((item) => item.seedUrl),
    [feedItems]
  );

  const loadFeed = useCallback(
    async (append: boolean) => {
      if (!showFeedTab) return;
      setFeedLoading(true);
      setFeedError(undefined);
      try {
        const result = await listRedditCandidates({
          genre,
          source: source as "hybrid" | "verbatim",
          limit: FEED_PAGE_SIZE,
          excludeUrls: append ? excludeUrls : undefined,
        });
        startTransition(() => {
          setFeedItems((current) => (append ? [...current, ...result.items] : result.items));
          setFeedHasMore(result.hasMore);
        });
      } catch (error) {
        setFeedError(error instanceof Error ? error.message : "Failed to load live feed");
      } finally {
        setFeedLoading(false);
      }
    },
    [excludeUrls, genre, showFeedTab, source]
  );

  const loadBank = useCallback(
    async (append: boolean) => {
      setBankLoading(true);
      setBankError(undefined);
      const offset = append ? bankItems.length : 0;
      try {
        const result = await listStoryBank({
          genre,
          source,
          limit: BANK_PAGE_SIZE,
          offset,
          sort: "fifo",
        });
        startTransition(() => {
          setBankItems((current) => (append ? [...current, ...result.items] : result.items));
          setBankHasMore(result.hasMore);
          setBankTotal(result.total);
        });
      } catch (error) {
        setBankError(error instanceof Error ? error.message : "Failed to load story bank");
      } finally {
        setBankLoading(false);
      }
    },
    [bankItems.length, genre, source]
  );

  useEffect(() => {
    let cancelled = false;
    const tasks: Promise<void>[] = [loadBank(false)];
    if (showFeedTab) tasks.unshift(loadFeed(false));
    void Promise.all(tasks).then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when filters change
  }, [genre, source, showFeedTab]);

  const handleTabChange = (next: PickerTab) => {
    startTransition(() => setTab(next));
  };

  const handleFeedSelect = (candidate: RedditCandidate) => {
    if (candidate.unavailable) return;
    const next: StorySelection = { kind: "feed", seedUrl: candidate.seedUrl };
    onSelect(selection?.kind === "feed" && selection.seedUrl === candidate.seedUrl ? null : next);
  };

  const handleBankSelect = (item: StoryBankItem) => {
    if (item.unavailable) return;
    const next: StorySelection = { kind: "bank", storyId: item.id };
    onSelect(selection?.kind === "bank" && selection.storyId === item.id ? null : next);
  };

  const refreshActive = () => {
    if (tab === "feed" && showFeedTab) void loadFeed(false);
    else void loadBank(false);
  };

  const emptyFeed = !feedLoading && !feedError && feedItems.length === 0;
  const emptyBank = !bankLoading && !bankError && bankItems.length === 0;

  return (
    <div className={cn("grid gap-3", compact ? "gap-2" : "gap-3")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {showFeedTab ? (
            <button
              type="button"
              onClick={() => handleTabChange("feed")}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium",
                tab === "feed"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-foreground hover:bg-accent"
              )}
            >
              Live feed
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => handleTabChange("bank")}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium",
              tab === "bank"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-foreground hover:bg-accent"
            )}
          >
            Story bank
            {bankTotal > 0 ? (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {bankTotal}
              </span>
            ) : null}
          </button>
        </div>
        <Button type="button" size="sm" variant="ghost" disabled={feedLoading || bankLoading} onClick={refreshActive}>
          <RefreshCw size={14} className={feedLoading || bankLoading ? "animate-spin" : undefined} />
          Refresh
        </Button>
      </div>

      {!compact ? (
        <p className="m-0 text-xs leading-relaxed text-muted-foreground">
          Pick one story for this reel. Live feed shows fresh Reddit posts; the bank holds pre-generated stories
          ready to film.
        </p>
      ) : null}

      {tab === "feed" && showFeedTab ? (
        <div className="grid gap-2">
          {feedError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {feedError}
            </div>
          ) : null}
          {emptyFeed ? (
            <div className="rounded-md border border-dashed border-border bg-black/10 px-3 py-6 text-center text-xs text-muted-foreground">
              No fresh posts for this genre right now. Try another genre, check the story bank, or use Auto-pick.
            </div>
          ) : (
            <div className="grid gap-2">
              {feedItems.map((candidate) => (
                <RedditCandidateCard
                  key={candidate.seedUrl}
                  candidate={candidate}
                  selected={selection?.kind === "feed" && selection.seedUrl === candidate.seedUrl}
                  showSeriesHint={seriesHint}
                  onSelect={() => handleFeedSelect(candidate)}
                />
              ))}
            </div>
          )}
          {feedLoading ? (
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="animate-spin" size={14} />
              Loading posts…
            </div>
          ) : null}
          {feedHasMore && !feedLoading ? (
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => void loadFeed(true)}>
              Load more
            </Button>
          ) : null}
        </div>
      ) : null}

      {tab === "bank" || !showFeedTab ? (
        <div className={cn("grid gap-2", tab !== "bank" && showFeedTab ? "hidden" : undefined)}>
          {bankError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {bankError}
            </div>
          ) : null}
          {emptyBank ? (
            <div className="rounded-md border border-dashed border-border bg-black/10 px-3 py-6 text-center text-xs text-muted-foreground">
              No unused stories in the bank for these filters. Try live feed, Auto-pick, or a custom topic.
            </div>
          ) : (
            <div className="grid gap-2">
              {bankItems.map((item) => (
                <StoryBankCard
                  key={item.id}
                  item={item}
                  selected={selection?.kind === "bank" && selection.storyId === item.id}
                  showSeriesHint={seriesHint}
                  onSelect={() => handleBankSelect(item)}
                />
              ))}
            </div>
          )}
          {bankLoading ? (
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="animate-spin" size={14} />
              Loading bank…
            </div>
          ) : null}
          {bankHasMore && !bankLoading ? (
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => void loadBank(true)}>
              Load more
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function storySelectionToCreateFields(
  selection: StorySelection | null
): { selectedStoryId?: string; selectedSeedUrl?: string } {
  if (!selection) return {};
  if (selection.kind === "bank") return { selectedStoryId: selection.storyId };
  return { selectedSeedUrl: selection.seedUrl };
}
