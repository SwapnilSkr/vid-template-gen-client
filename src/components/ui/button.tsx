import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-8 cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md border text-[13px] font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
        outline:
          "border-border bg-transparent text-foreground hover:border-input hover:bg-secondary",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-accent",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
      },
      size: {
        sm: "min-h-7 px-2.5 text-xs",
        default: "min-h-8 px-3",
        lg: "min-h-9 px-4 text-sm",
        icon: "size-8 p-0",
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
