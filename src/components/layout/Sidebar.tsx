import { Link, useRouterState } from "@tanstack/react-router";
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  Home,
  Layers3,
  ListVideo,
  Play,
  Send,
  TrendingUp,
  Youtube,
} from "lucide-react";
import type { Reel } from "@/api/reels";
import { cn } from "@/lib/utils";
import { useReelStudio } from "@/store/reel-studio";

type QueueFilter = "intake" | "in_progress" | "review" | "approved" | "published" | "rejected";

const IN_PROGRESS_STATUSES: Reel["status"][] = [
  "planning",
  "generating_assets",
  "generating_audio",
  "aligning",
  "rendering",
  "uploading",
];

function countByFilter(reels: Reel[], filter: QueueFilter): number {
  switch (filter) {
    case "intake":
      return reels.filter((r) => r.status === "pending").length;
    case "in_progress":
      return reels.filter((r) => IN_PROGRESS_STATUSES.includes(r.status)).length;
    case "review":
      return reels.filter((r) => r.status === "completed").length;
    case "approved":
      return reels.filter((r) => r.status === "completed" && r.review?.status === "approved").length;
    case "published":
      return reels.filter((r) => r.youtube?.status === "published").length;
    case "rejected":
      return reels.filter((r) => r.status === "failed").length;
  }
}

const queueNav: { name: string; icon: typeof Home; filter: QueueFilter }[] = [
  { name: "Intake", icon: Layers3, filter: "intake" },
  { name: "In Progress", icon: Clock3, filter: "in_progress" },
  { name: "Review", icon: CheckCircle2, filter: "review" },
  { name: "Approved", icon: CheckCircle2, filter: "approved" },
  { name: "Published", icon: Send, filter: "published" },
  { name: "Rejected", icon: CircleAlert, filter: "rejected" },
];

/** Library sections without a backing screen yet — shown but disabled instead
 * of a dead "#" link, so it's honest about what's actually built. */
const comingSoonLibraryNav = ["Templates", "Assets", "Voices"] as const;

interface SidebarProps {
  mobileOpen?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ mobileOpen = false, onNavigate }: SidebarProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const search = useRouterState({ select: (state) => state.location.search as { status?: string } });
  const reels = useReelStudio((state) => state.reels);

  const navLinkClass = (isActive: boolean) =>
    cn(
      "grid min-h-9 grid-cols-[18px_1fr_auto] items-center gap-2.5 rounded-md border border-transparent px-2.5 py-2 text-sm font-bold text-sidebar-foreground/85 no-underline transition-colors hover:border-border hover:bg-card/70 hover:text-foreground",
      isActive && "border-primary/55 bg-primary text-sidebar-accent-foreground shadow-[var(--shadow-sidebar-active)] hover:bg-primary hover:text-sidebar-accent-foreground"
    );

  return (
    <nav
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 overflow-auto border-r border-border bg-sidebar px-2.5 py-4 transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-auto lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <Link
        to="/"
        search={{ status: undefined }}
        onClick={onNavigate}
        className="mb-4 flex min-h-14 items-center gap-2.5 rounded-lg border border-border bg-card/50 px-3 py-3 no-underline"
      >
        <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
          <Play size={19} />
        </span>
        <div className="min-w-0">
          <strong className="block text-base leading-tight text-foreground">ReelForge</strong>
          <span className="block truncate text-xs text-muted-foreground">Shorts production console</span>
        </div>
      </Link>

      <div className="mx-2.5 mb-2 mt-5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Insights</div>
      <Link to="/trends" onClick={onNavigate} className={navLinkClass(pathname === "/trends")}>
        <TrendingUp size={17} />
        <span>Trend Scout</span>
      </Link>

      <div className="mx-2.5 mb-2 mt-5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Queue</div>
      <Link
        to="/"
        search={{ status: undefined }}
        onClick={onNavigate}
        className={navLinkClass(pathname === "/" && !search.status)}
      >
        <Home size={17} />
        <span>Overview</span>
      </Link>
      {queueNav.map(({ name, icon: Icon, filter }) => {
        const count = countByFilter(reels, filter);
        const isActive = pathname === "/" && search.status === filter;
        return (
          <Link
            key={name}
            to="/"
            search={{ status: filter }}
            onClick={onNavigate}
            className={navLinkClass(isActive)}
          >
            <Icon size={17} />
            <span>{name}</span>
            <em
              className={cn(
                "min-w-6 rounded-full border border-border bg-muted px-2 py-0.5 text-center text-xs not-italic text-muted-foreground",
                isActive && "border-black/10 bg-black/15 text-primary-foreground"
              )}
            >
              {count}
            </em>
          </Link>
        );
      })}

      <div className="mx-2.5 mb-2 mt-5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Library</div>
      <Link
        to="/youtube"
        onClick={onNavigate}
        className={navLinkClass(pathname.startsWith("/youtube"))}
      >
        <Youtube size={17} />
        <span>YouTube Import</span>
      </Link>
      <Link
        to="/"
        search={{ status: undefined }}
        onClick={onNavigate}
        className={navLinkClass(pathname === "/" && !search.status)}
      >
        <ListVideo size={17} />
        <span>Reels</span>
      </Link>
      {comingSoonLibraryNav.map((item) => (
        <div
          key={item}
          aria-disabled="true"
          className="grid min-h-9 cursor-not-allowed grid-cols-[18px_1fr_auto] items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-bold text-muted-foreground/55"
        >
          <ListVideo size={17} />
          <span>{item}</span>
          <em className="whitespace-nowrap text-[10px] font-bold not-italic uppercase text-muted-foreground/60">Soon</em>
        </div>
      ))}
    </nav>
  );
}
