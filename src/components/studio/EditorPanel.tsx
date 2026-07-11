import { cn } from "@/lib/utils";

export function EditorPanel({
  title,
  icon,
  actions,
  className,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-lg border border-border bg-card", className)}>
      <div className="flex min-h-10 items-center justify-between gap-3 border-b border-border px-3 py-2">
        <strong className="section-label inline-flex min-w-0 items-center gap-2">
          {icon ? <span className="text-muted-foreground/70">{icon}</span> : null}
          <span className="truncate">{title}</span>
        </strong>
        {actions}
      </div>
      {children}
    </section>
  );
}

