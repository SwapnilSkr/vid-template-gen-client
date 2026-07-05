import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-primary bg-primary text-primary-foreground shadow-[0_10px_28px_rgba(34,211,238,0.18)] hover:bg-primary/90",
        outline: "border-border bg-card text-foreground hover:border-primary/55 hover:bg-accent hover:text-accent-foreground",
        secondary: "border-border bg-secondary text-secondary-foreground hover:bg-accent",
        destructive: "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90",
        ghost: "border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "min-h-9 px-3 py-2",
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
