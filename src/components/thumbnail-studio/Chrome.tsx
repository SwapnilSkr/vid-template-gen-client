import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StudioPanel({
  title,
  icon,
  actions,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card">
      <div className="flex min-h-10 items-center justify-between gap-3 border-b border-border px-3 py-2">
        <strong className="section-label inline-flex min-w-0 items-center gap-2">
          {icon ? <span className="text-muted-foreground/70">{icon}</span> : null}
          <span className="truncate">{title}</span>
        </strong>
        {actions}
      </div>
      <div className="grid min-w-0 gap-2.5 p-3">{children}</div>
    </section>
  );
}

export function SourceButton({
  active,
  disabled,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid justify-items-center gap-1 rounded-md border px-1.5 py-2 text-[11px] font-semibold transition-colors disabled:opacity-45",
        active
          ? "border-primary bg-primary/12 text-primary"
          : "border-border bg-secondary text-foreground hover:bg-accent"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export function ToolbarButton({
  title,
  disabled,
  active,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-45",
        active
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
