import { Link, useRouterState } from "@tanstack/react-router";
import {
  CheckCircle2,
  CircleAlert,
  CircleCheck,
  Clock3,
  Home,
  Layers3,
  ListVideo,
  Play,
  Activity,
  BarChart3,
  Send,
  TrendingUp,
  UsersRound,
  Youtube,
  Gamepad2,
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
  { name: "Approved", icon: CircleCheck, filter: "approved" },
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="section-label mb-1 mt-6 px-2.5">{children}</div>;
}

export function Sidebar({ mobileOpen = false, onNavigate }: SidebarProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const search = useRouterState({ select: (state) => state.location.search as { status?: string } });
  const reels = useReelStudio((state) => state.reels);

  const navLinkClass = (isActive: boolean) =>
    cn(
      "grid min-h-8 grid-cols-[16px_1fr_auto] items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-sidebar-foreground no-underline transition-colors hover:bg-secondary hover:text-foreground",
      isActive && "bg-accent text-foreground hover:bg-accent"
    );

  return (
    <nav
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-60 overflow-y-auto border-r border-border bg-sidebar px-3 py-4 transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-auto lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <Link
        to="/"
        search={{ status: undefined }}
        onClick={onNavigate}
        className="flex items-center gap-2.5 rounded-md px-2 py-1.5 no-underline"
      >
        <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
          <Play size={14} fill="currentColor" />
        </span>
        <span className="text-sm font-semibold tracking-tight text-foreground">ReelForge</span>
      </Link>

      <SectionLabel>Insights</SectionLabel>
      <Link to="/trends" onClick={onNavigate} className={navLinkClass(pathname === "/trends")}>
        <TrendingUp size={15} />
        <span>YouTube Research</span>
      </Link>
      <Link to="/analytics" onClick={onNavigate} className={navLinkClass(pathname === "/analytics")}>
        <BarChart3 size={15} />
        <span>Performance</span>
      </Link>

      <SectionLabel>Queue</SectionLabel>
      <Link
        to="/"
        search={{ status: undefined }}
        onClick={onNavigate}
        className={navLinkClass(pathname === "/" && !search.status)}
      >
        <Home size={15} />
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
            <Icon size={15} />
            <span>{name}</span>
            {count > 0 ? (
              <em className="min-w-5 rounded px-1 text-right text-xs font-normal not-italic tabular-nums text-muted-foreground">
                {count}
              </em>
            ) : null}
          </Link>
        );
      })}

      <SectionLabel>Library</SectionLabel>
      <Link to="/accounts" onClick={onNavigate} className={navLinkClass(pathname === "/accounts")}>
        <UsersRound size={15} />
        <span>Accounts</span>
      </Link>
      <Link to="/operations" onClick={onNavigate} className={navLinkClass(pathname === "/operations")}>
        <Activity size={15} />
        <span>Operations</span>
      </Link>
      <Link
        to="/youtube"
        onClick={onNavigate}
        className={navLinkClass(pathname.startsWith("/youtube"))}
      >
        <Youtube size={15} />
        <span>YouTube Import</span>
      </Link>
      <Link to="/gameplay" onClick={onNavigate} className={navLinkClass(pathname === "/gameplay")}>
        <Gamepad2 size={15} />
        <span>Gameplay</span>
      </Link>
      <Link
        to="/"
        search={{ status: undefined }}
        onClick={onNavigate}
        className={navLinkClass(false)}
      >
        <ListVideo size={15} />
        <span>Reels</span>
      </Link>
      {comingSoonLibraryNav.map((item) => (
        <div
          key={item}
          aria-disabled="true"
          className="grid min-h-8 cursor-not-allowed grid-cols-[16px_1fr_auto] items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground/40"
        >
          <ListVideo size={15} />
          <span>{item}</span>
          <em className="text-[10px] font-medium not-italic uppercase tracking-wide text-muted-foreground/40">Soon</em>
        </div>
      ))}
    </nav>
  );
}
