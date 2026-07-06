import { cn } from "@/lib/utils";

export const panelClassName = "rounded-lg border border-border bg-card";

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
      className={cn("flex items-center justify-between gap-3 border-b border-border px-3.5 py-2.5", className)}
      {...props}
    />
  );
}

export function PanelTitle({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }) {
  return <strong ref={ref} className={cn("text-sm font-semibold text-foreground", className)} {...props} />;
}
