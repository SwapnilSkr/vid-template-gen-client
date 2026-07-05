import { cn } from "@/lib/utils";

export const panelClassName =
  "rounded-lg border border-border bg-card shadow-[var(--shadow-panel)]";

export function Panel({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }) {
  return <section ref={ref} className={cn(panelClassName, className)} {...props} />;
}

export function PanelHeader({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      className={cn("flex items-center justify-between gap-3 border-b border-border/70 bg-black/10 px-3.5 py-3", className)}
      {...props}
    />
  );
}

export function PanelTitle({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }) {
  return <strong ref={ref} className={cn("text-[15px] text-foreground", className)} {...props} />;
}
