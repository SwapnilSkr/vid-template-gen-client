import { cn } from "@/lib/utils";

export interface DropdownProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  ref?: React.Ref<HTMLSelectElement>;
}

const dropdownChevron =
  'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23888c99%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")';

export function Dropdown({ className, ref, style, ...props }: DropdownProps) {
  return (
    <select
      ref={ref}
      style={{
        backgroundImage: dropdownChevron,
        backgroundPosition: "right 0.625rem center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "14px",
        ...style,
      }}
      className={cn(
        "min-h-8 w-full appearance-none rounded-md border border-border bg-background py-1.5 pl-2.5 pr-8 text-[13px] text-foreground outline-none transition-colors hover:border-input focus:border-primary/60 focus:ring-2 focus:ring-ring/25 disabled:bg-muted disabled:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Dropdown as Select };
