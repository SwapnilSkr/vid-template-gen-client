import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-9 cursor-pointer select-none items-center justify-center gap-2 rounded-md border px-3 py-2 text-[13px] font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/25 active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-primary/80 bg-gradient-to-b from-primary to-primary/85 text-primary-foreground shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_10px_26px_rgba(45,212,191,0.22)] hover:brightness-105",
        outline:
          "border-border bg-secondary/60 text-foreground shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] hover:border-primary/45 hover:bg-accent hover:text-accent-foreground",
        secondary:
          "border-border bg-secondary text-secondary-foreground shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] hover:bg-accent",
        destructive:
          "border-destructive/80 bg-gradient-to-b from-destructive to-destructive/85 text-destructive-foreground shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_10px_26px_rgba(220,38,38,0.2)] hover:brightness-105",
        ghost: "border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        sm: "min-h-8 px-2.5 py-1.5 text-xs",
        default: "min-h-9 px-3 py-2",
        lg: "min-h-10 px-4 py-2.5 text-sm",
        icon: "size-9 p-0",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ref, ...props }: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  return <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export function buttonClassName(variant: NonNullable<VariantProps<typeof buttonVariants>["variant"]> = "outline") {
  return buttonVariants({ variant });
}
