import { useEffect, useMemo, useState } from "react";
import { AtSign, BarChart3, Facebook, Instagram, Loader2, RefreshCw, Youtube } from "lucide-react";
import {
  getOwnedAnalyticsOverview,
  syncOwnedAnalytics,
  type OwnedAnalyticsOverview,
  type OwnedAnalyticsPlatform,
} from "@/api/analytics";
import { Button } from "@/components/ui/button";
import { PanelTitle, panelClassName } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

const PLATFORM_CONFIG: { id: OwnedAnalyticsPlatform; label: string; icon: typeof Youtube; description: string }[] = [
  { id: "youtube", label: "YouTube Shorts", icon: Youtube, description: "Your own watch and engagement performance; public YouTube research remains separate." },
  { id: "instagram", label: "Instagram Reels", icon: Instagram, description: "Your own reach, shares, saves, comments and follow signals only." },
  { id: "facebook", label: "Facebook Reels", icon: Facebook, description: "Your own Page-Reel signals when Meta makes them available." },
  { id: "threads", label: "Threads", icon: AtSign, description: "Your own views, replies, reposts and quotes only." },
];

function syncMessage(platform: string, result: Awaited<ReturnType<typeof syncOwnedAnalytics>>): string {
  if (result.requiresReauth.length) return `${platform}: reconnect the affected account to grant its analytics permission, then sync again.`;
  if (!result.scanned) return `${platform}: no published destinations were found in the last 90 days.`;
  return `${platform}: saved ${result.snapshotsCreated} metric snapshot${result.snapshotsCreated === 1 ? "" : "s"}; rebuilt ${result.cardsRebuilt} learning card${result.cardsRebuilt === 1 ? "" : "s"}.`;
}

export function AnalyticsScreen() {
  const [overview, setOverview] = useState<OwnedAnalyticsOverview>();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<OwnedAnalyticsPlatform | "all" | undefined>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  async function load() {
    setLoading(true);
    try {
      setOverview(await getOwnedAnalyticsOverview());
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load owned analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const stats = useMemo(() => new Map((overview?.platforms ?? []).map((entry) => [entry.platform, entry])), [overview]);

  async function sync(platform?: OwnedAnalyticsPlatform) {
    const target = platform ?? "all";
    setSyncing(target);
    setError(undefined);
    setMessage(undefined);
    try {
      const result = await syncOwnedAnalytics(platform);
      setMessage(platform ? syncMessage(PLATFORM_CONFIG.find((item) => item.id === platform)?.label ?? platform, result) : `All connected platforms: ${result.snapshotsCreated} snapshots saved and ${result.cardsRebuilt} learning cards rebuilt.${result.requiresReauth.length ? " Some accounts need reconnecting for analytics access." : ""}`);
      setOverview(await getOwnedAnalyticsOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sync owned analytics.");
    } finally {
      setSyncing(undefined);
    }
  }

  return (
    <section className="min-w-0 px-4 py-4 sm:px-5 lg:px-6">
      <header className="mb-5 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="m-0 flex items-center gap-2 text-lg leading-tight text-foreground"><BarChart3 size={22} className="text-primary" /> Performance analytics</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">First-party performance from your connected accounts. Each platform learns from itself; it does not borrow another platform’s audience signals.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void sync()} disabled={Boolean(syncing)}>
          {syncing === "all" ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Sync all platforms
        </Button>
      </header>

      {error ? <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs leading-relaxed text-destructive">{error}</div> : null}
      {message ? <div className="mb-3 rounded-lg border border-border bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">{message}</div> : null}

      <div className="grid gap-3 md:grid-cols-2">
        {PLATFORM_CONFIG.map(({ id, label, icon: Icon, description }) => {
          const platformStats = stats.get(id);
          const cards = (overview?.cards ?? []).filter((card) => card.platform === id && card.account.scope === "all");
          return (
            <article key={id} className={cn(panelClassName, "grid gap-3 p-3.5")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <PanelTitle><span className="inline-flex items-center gap-2"><Icon size={17} />{label}</span></PanelTitle>
                  <p className="mb-0 mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => void sync(id)} disabled={Boolean(syncing)}>
                  {syncing === id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Sync
                </Button>
              </div>
              <p className="m-0 text-xs text-muted-foreground">{platformStats?.snapshots ?? 0} saved snapshots{platformStats?.lastFetchedAt ? ` · last fetched ${new Date(platformStats.lastFetchedAt).toLocaleString()}` : ""}</p>
              {cards.length ? cards.slice(0, 2).map((card) => (
                <div key={card._id} className="rounded-md border border-border bg-muted/30 p-2.5">
                  <div className="flex justify-between gap-2 text-xs"><span className="font-medium capitalize">{card.genre.replace(/_/g, " ")}</span><span className="text-muted-foreground">{card.confidence.level} confidence</span></div>
                  <p className="mb-0 mt-1.5 text-xs leading-relaxed text-muted-foreground">{card.guidance.summary}</p>
                  <p className="mb-0 mt-1.5 text-[11px] text-muted-foreground">{card.confidence.sampleSize} eligible posts · last {card.window.days} days</p>
                </div>
              )) : <p className="m-0 rounded-md border border-dashed border-border px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">No eligible learning card yet. Post, wait until the metrics mature, then sync this platform.</p>}
            </article>
          );
        })}
      </div>
      {loading ? <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={15} className="animate-spin" />Loading saved performance evidence…</div> : null}
    </section>
  );
}
