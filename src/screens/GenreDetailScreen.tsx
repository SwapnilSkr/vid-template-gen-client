import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowLeft, Play } from "lucide-react";
import { panelClassName } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { formatLabel } from "@/utils/reel";

const route = getRouteApi("/trends/$genre");

function formatViews(n?: number): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatPostedAt(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Every scouted sample for one genre — the "13+ samples" view the summary
 * cards on /trends only teased the top few of. Data is loaded by the route's
 * loader before this screen mounts (see main.tsx), so there's no fetch flash. */
export function GenreDetailScreen() {
  const samples = route.useLoaderData();
  const { genre } = route.useParams();

  return (
    <section className="min-w-0 px-4 py-4 sm:px-5 lg:px-6">
      <header className="mb-5 grid gap-2 border-b border-border pb-4">
        <Link
          to="/trends"
          className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted-foreground no-underline hover:text-foreground"
        >
          <ArrowLeft size={15} /> Back to Trend Scout
        </Link>
        <h1 className="m-0 text-lg leading-tight text-foreground">{formatLabel(genre)}</h1>
        <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
          {samples.length} sample{samples.length === 1 ? "" : "s"} scouted for this genre.
        </p>
      </header>

      {!samples.length ? (
        <div className={cn(panelClassName, "grid place-items-center gap-2 p-8 text-center text-muted-foreground")}>
          <p className="m-0 text-sm">No samples for this genre yet — run the scout from the Trend Scout page.</p>
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {samples.map((sample) => (
            <a
              key={sample._id ?? sample.sourceUrl}
              href={sample.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(panelClassName, "grid gap-2 overflow-hidden p-0 no-underline transition-shadow hover:shadow-md")}
            >
              {sample.thumbnailUrl ? (
                <img
                  className="aspect-video w-full object-cover"
                  src={sample.thumbnailUrl}
                  alt={sample.title ?? "Sample"}
                />
              ) : (
                <div className="grid aspect-video w-full place-items-center bg-muted text-muted-foreground">
                  <Play size={20} />
                </div>
              )}
              <div className="grid gap-1 px-3 pb-3">
                <span className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground">
                  {sample.title ?? "Untitled"}
                </span>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">{sample.channelTitle}</span>
                  <span className="whitespace-nowrap font-medium text-foreground">{formatViews(sample.metrics?.views)}</span>
                </div>
                {sample.metrics?.postedAt ? (
                  <span className="text-xs text-muted-foreground">{formatPostedAt(sample.metrics.postedAt)}</span>
                ) : null}
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
