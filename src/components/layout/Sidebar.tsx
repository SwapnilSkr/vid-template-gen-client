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
const comingSoonLibraryNav = ["Templates", "Assets", "Voices", "Captions"] as const;

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
      "grid min-h-9 grid-cols-[18px_1fr_auto] items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground no-underline",
      isActive && "bg-sidebar-accent text-sidebar-accent-foreground shadow-[var(--shadow-sidebar-active)]"
    );

  return (
    <nav
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 overflow-auto border-r border-border bg-sidebar px-2 py-4 transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-auto lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <Link
        to="/"
        search={{ status: undefined }}
        onClick={onNavigate}
        className="mb-3 flex min-h-12 items-center gap-2.5 border-b border-border/60 px-2.5 pb-4 no-underline"
      >
        <Play className="text-primary" size={22} />
        <div>
          <strong className="block text-base leading-tight text-foreground">ReelForge</strong>
          <span className="block text-xs text-muted-foreground">Shorts / Reddit Reels</span>
        </div>
      </Link>

      <div className="mx-2.5 mb-2 mt-5 text-[11px] font-extrabold uppercase text-muted-foreground">Insights</div>
      <Link to="/trends" onClick={onNavigate} className={navLinkClass(pathname === "/trends")}>
        <TrendingUp size={17} />
        <span>Trend Scout</span>
      </Link>

      <div className="mx-2.5 mb-2 mt-5 text-[11px] font-extrabold uppercase text-muted-foreground">Queue</div>
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
                "min-w-6 rounded-full bg-muted px-2 py-0.5 text-center text-xs not-italic text-muted-foreground",
                isActive && "bg-white/20 text-white"
              )}
            >
              {count}
            </em>
          </Link>
        );
      })}

      <div className="mx-2.5 mb-2 mt-5 text-[11px] font-extrabold uppercase text-muted-foreground">Library</div>
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
          className="grid min-h-9 cursor-not-allowed grid-cols-[18px_1fr_auto] items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground/60"
        >
          <ListVideo size={17} />
          <span>{item}</span>
          <em className="whitespace-nowrap text-[10px] font-bold not-italic uppercase text-muted-foreground/60">Soon</em>
        </div>
      ))}
    </nav>
  );
}
