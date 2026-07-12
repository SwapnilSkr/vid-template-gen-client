import { cn } from "@/lib/utils";

export const panelClassName = "rounded-xl border border-border/40 bg-card/65 shadow-[0_8px_30px_rgb(0,0,0,0.3)] backdrop-blur-md";

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
      className={cn("flex items-center justify-between gap-3 border-b border-border/20 px-4 py-3 bg-white/[0.02]", className)}
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
