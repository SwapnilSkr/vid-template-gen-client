import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Play,
  TrendingUp,
  UsersRound,
  Youtube,
} from "lucide-react";
import { cn } from "@/lib/utils";





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
        <span>Trend Scout</span>
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


      <SectionLabel>Library</SectionLabel>
      <Link to="/accounts" onClick={onNavigate} className={navLinkClass(pathname === "/accounts")}>
        <UsersRound size={15} />
        <span>Accounts</span>
      </Link>
      <Link
        to="/youtube"
        onClick={onNavigate}
        className={navLinkClass(pathname.startsWith("/youtube"))}
      >
        <Youtube size={15} />
        <span>YouTube Import</span>
      </Link>

    </nav>
  );
}
