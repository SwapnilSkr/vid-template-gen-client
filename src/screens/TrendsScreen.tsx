import { Link } from "@tanstack/react-router";
import { ChevronRight, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getTrendSummary,
  listHorrorReferences,
  type HorrorReference,
  triggerHorrorReferenceScout,
  triggerTrendScout,
  type TrendGenreSummary,
} from "@/api/trends";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { PanelTitle, panelClassName } from "@/components/ui/panel";
import { NICHES } from "@/constants/reels";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatViews(n?: number): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatBestTime(dayOfWeek: number, hourUtc: number): string {
  const hour12 = hourUtc % 12 === 0 ? 12 : hourUtc % 12;
  const ampm = hourUtc < 12 ? "AM" : "PM";
  return `${DAY_LABELS[dayOfWeek]} ${hour12}${ampm} UTC`;
}

export function TrendsScreen() {
  const [niche, setNiche] = useState<string>("reddit");
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [summary, setSummary] = useState<TrendGenreSummary[]>([]);
  const [horrorReferences, setHorrorReferences] = useState<HorrorReference[]>([]);
  const [loading, setLoading] = useState(false);
  const [scouting, setScouting] = useState(false);
  const [scrapingStories, setScrapingStories] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [scoutMessage, setScoutMessage] = useState<string | undefined>();
  const isHorror = niche.startsWith("horror");

  async function load() {
    setLoading(true);
    setError(undefined);
    try {
      setSummary(await getTrendSummary(period, niche));
      if (niche.startsWith("horror")) {
        setHorrorReferences(await listHorrorReferences(8));
      } else {
        setHorrorReferences([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trend summary");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, niche]);

  async function runScout() {
    setScouting(true);
    setError(undefined);
    setScoutMessage(undefined);
    try {
      const result = await triggerTrendScout(period, niche);
      const totalUpserted = result.results.reduce((sum, item) => sum + item.upserted, 0);
      const failed = result.failed ?? result.results.filter((item) => item.error);
      setScoutMessage(
        failed.length
          ? `Scout saved ${totalUpserted} samples and refreshed ${result.digestsRefreshed} digests. ${failed.length} target${failed.length === 1 ? "" : "s"} failed; see server logs for full API errors.`
          : `Scout saved ${totalUpserted} samples and refreshed ${result.digestsRefreshed} digests.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run trend scout");
    } finally {
      setScouting(false);
    }
  }

  async function runHorrorReferenceScout() {
    setScrapingStories(true);
    setError(undefined);
    setScoutMessage(undefined);
    try {
      const result = await triggerHorrorReferenceScout(20);
      setScoutMessage(
        `Horror story scrape scanned ${result.scanned} public-domain references and saved ${result.upserted}. ${result.skipped} skipped${result.errors.length ? `, ${result.errors.length} errors` : ""}.`
      );
      setHorrorReferences(await listHorrorReferences(8));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scrape horror story references");
    } finally {
      setScrapingStories(false);
    }
  }

  return (
    <section className="min-w-0 px-4 py-4 sm:px-5 lg:px-6">
      <header className="mb-3.5 grid min-h-12 gap-3 sm:flex sm:items-start sm:justify-between">
        <div>
          <h1 className="m-0 flex items-center gap-2 text-2xl leading-tight tracking-normal text-foreground">
            <TrendingUp size={22} className="text-primary" /> Trend Scout
          </h1>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Top-performing {NICHES.find((n) => n.value === niche)?.label ?? niche} Shorts per genre, pulled
            from YouTube — feeds hooks, titles, and thumbnail prompts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="w-auto min-w-[9.5rem]"
            value={niche}
            onChange={(event) => setNiche(event.target.value)}
          >
            {NICHES.map((n) => (
              <option key={n.value} value={n.value}>
                {n.label}
              </option>
            ))}
          </Select>
          <Select
            className="w-auto min-w-[8rem]"
            value={period}
            onChange={(event) => setPeriod(event.target.value as "week" | "month")}
          >
            <option value="week">This week</option>
            <option value="month">This month</option>
          </Select>
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? "animate-spin" : undefined} />
            Refresh
          </Button>
          <Button type="button" variant="default" onClick={() => void runScout()} disabled={scouting}>
            {scouting ? <Loader2 className="animate-spin" size={16} /> : <TrendingUp size={16} />}
            Run Scout
          </Button>
          {isHorror ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void runHorrorReferenceScout()}
              disabled={scrapingStories}
            >
              {scrapingStories ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
              Scrape Stories
            </Button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs leading-relaxed text-destructive">
          {error}
        </div>
      ) : null}
      {scoutMessage ? (
        <div className="mb-3 rounded-lg border border-border bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {scoutMessage}
        </div>
      ) : null}

      {!summary.length && !loading ? (
        <div className={cn(panelClassName, "grid place-items-center gap-2 p-8 text-center text-muted-foreground")}>
          <TrendingUp size={22} />
          <p className="m-0 text-sm">
            No trend data yet for this window. Run the scout, or seed it with{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">bun scripts/trend-scout-backfill.ts</code>.
          </p>
        </div>
      ) : null}

      {isHorror ? <HorrorReferenceLibrary refs={horrorReferences} loading={loading || scrapingStories} /> : null}

      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {summary.map((genre) => (
          <GenreCard key={genre.genre} genre={genre} />
        ))}
      </div>
    </section>
  );
}

function GenreCard({ genre }: { genre: TrendGenreSummary }) {
  const top = genre.topPerformers[0];
  return (
    <div className={cn(panelClassName, "grid gap-2.5 p-3.5")}>
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/trends/$genre"
          params={{ genre: genre.genre }}
          className="no-underline hover:underline"
        >
          <PanelTitle>{genre.displayLabel}</PanelTitle>
        </Link>
        <span className="text-xs text-muted-foreground">{genre.sampleSize} samples</span>
      </div>

      {top?.thumbnailUrl ? (
        <a href={top.sourceUrl} target="_blank" rel="noreferrer" className="block">
          <img
            className="aspect-video w-full rounded-md border border-border object-cover transition-opacity hover:opacity-90"
            src={top.thumbnailUrl}
            alt={top.title ?? "Top performer"}
          />
        </a>
      ) : null}

      <div className="grid gap-1.5">
        {genre.topPerformers.map((perf) => (
          <a
            key={perf.sourceUrl}
            href={perf.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md px-1.5 py-1 text-xs no-underline hover:bg-accent"
          >
            <span className="truncate font-semibold text-foreground">{perf.title ?? "Untitled"}</span>
            <span className="whitespace-nowrap font-bold text-muted-foreground">{formatViews(perf.views)}</span>
          </a>
        ))}
      </div>

      {genre.bestPostingTime ? (
        <div className="rounded-md bg-muted px-2.5 py-2 text-xs font-bold text-foreground">
          Best posting time: {formatBestTime(genre.bestPostingTime.dayOfWeek, genre.bestPostingTime.hourUtc)}
          <span className="ml-1.5 font-normal text-muted-foreground">(competitor-timing prior)</span>
        </div>
      ) : null}

      <Link
        to="/trends/$genre"
        params={{ genre: genre.genre }}
        className="flex items-center justify-center gap-1 rounded-md border border-border py-2 text-xs font-bold text-foreground no-underline hover:bg-accent"
      >
        View all {genre.sampleSize} samples
        <ChevronRight size={14} />
      </Link>
    </div>
  );
}

function HorrorReferenceLibrary({ refs, loading }: { refs: HorrorReference[]; loading: boolean }) {
  return (
    <div className={cn(panelClassName, "mb-3 grid gap-3 p-3.5")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <PanelTitle>Horror Story References</PanelTitle>
          <p className="m-0 mt-1 text-xs leading-relaxed text-muted-foreground">
            Public-domain references used by the AI horror story-bible pass. These guide atmosphere and structure, not verbatim narration.
          </p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
          {loading ? "Loading" : `${refs.length} shown`}
        </span>
      </div>

      {!refs.length ? (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-xs font-semibold text-muted-foreground">
          No scraped references yet. Use Scrape Stories to seed the horror planner.
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {refs.map((ref) => (
            <a
              key={ref._id ?? ref.sourceUrl}
              href={ref.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="grid min-h-40 gap-2 rounded-md border border-border bg-background/70 p-3 text-xs no-underline hover:bg-accent"
            >
              <div className="min-w-0">
                <div className="line-clamp-2 font-extrabold leading-snug text-foreground">{ref.title}</div>
                <div className="mt-1 truncate font-semibold text-muted-foreground">{ref.author ?? "Unknown author"}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                <span className="rounded-full bg-muted px-2 py-0.5 font-bold text-muted-foreground">
                  score {ref.qualityScore}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 font-bold text-muted-foreground">
                  used {ref.usedInReelIds?.length ?? 0}
                </span>
                <span className="rounded-full bg-success/15 px-2 py-0.5 font-bold text-success-foreground">
                  {ref.license.replace("_", " ")}
                </span>
              </div>
              <div className="line-clamp-2 leading-snug text-muted-foreground">
                {ref.genreTags.slice(0, 4).join(" · ") || "classic horror"}
              </div>
              <div className="line-clamp-3 leading-snug text-muted-foreground">{ref.excerpt}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
