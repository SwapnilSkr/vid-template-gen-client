import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  ref?: React.Ref<HTMLInputElement>;
}

export function Input({ className, ref, ...props }: InputProps) {
  return (
    <input
      ref={ref}
      className={cn(
        "min-h-8 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground outline-none transition-colors hover:border-input focus:border-primary/60 focus:ring-2 focus:ring-ring/25 disabled:bg-muted disabled:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: React.Ref<HTMLTextAreaElement>;
}

export function Textarea({ className, ref, ...props }: TextareaProps) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full resize-y rounded-md border border-border bg-background px-2.5 py-2 text-[13px] leading-relaxed text-foreground outline-none transition-colors hover:border-input focus:border-primary/60 focus:ring-2 focus:ring-ring/25 disabled:bg-muted disabled:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Select } from "@/components/ui/dropdown";
