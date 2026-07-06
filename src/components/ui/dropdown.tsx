import { cn } from "@/lib/utils";

export interface DropdownProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  ref?: React.Ref<HTMLSelectElement>;
}

const dropdownChevron =
  'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2394a3b8%27 stroke-width=%272.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")';

export function Dropdown({ className, ref, style, ...props }: DropdownProps) {
  return (
    <select
      ref={ref}
      style={{
        backgroundImage: dropdownChevron,
        backgroundPosition: "right 0.75rem center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "16px",
        ...style,
      }}
      className={cn(
        "min-h-[38px] w-full appearance-none rounded-md border border-input/70 bg-background/55 py-2 pl-2.5 pr-9 text-[13px] font-semibold text-foreground shadow-[0_1px_0_rgba(255,255,255,0.02)_inset] outline-none transition-colors hover:border-input focus:border-primary/70 focus:ring-3 focus:ring-ring/20 disabled:bg-muted disabled:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Dropdown as Select };
