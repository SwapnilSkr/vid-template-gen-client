import { Outlet } from "@tanstack/react-router";
import { Menu, Play, X } from "lucide-react";
import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

export function RootLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="app-surface grid min-h-screen grid-cols-1 bg-background lg:grid-cols-[232px_minmax(0,1fr)]">
      <div className="sticky top-0 z-30 flex items-center justify-between gap-2.5 border-b border-border bg-sidebar/95 px-3 py-2.5 backdrop-blur lg:hidden">
        <span className="flex items-center gap-2 text-sm font-extrabold text-foreground">
          <Play className="text-primary" size={18} />
          ReelForge
        </span>
        <button
          type="button"
          onClick={() => setMobileNavOpen((open) => !open)}
          className="grid size-9 place-items-center rounded-md border border-border bg-card text-foreground"
          aria-label="Toggle navigation"
        >
          {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <Sidebar mobileOpen={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} />

      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <Outlet />
    </div>
  );
}
