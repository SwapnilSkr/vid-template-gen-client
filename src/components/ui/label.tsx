import { cn } from "@/lib/utils";

export function Label({
  className,
  ref,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { ref?: React.Ref<HTMLLabelElement> }) {
  return (
    <label
      ref={ref}
      className={cn("grid gap-1.5 text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}
