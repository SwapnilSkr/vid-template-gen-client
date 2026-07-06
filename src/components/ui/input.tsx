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
        "min-h-[38px] w-full rounded-md border border-input/70 bg-background/55 px-2.5 py-2 text-[13px] font-semibold text-foreground shadow-[0_1px_0_rgba(255,255,255,0.02)_inset] outline-none transition-colors hover:border-input focus:border-primary/70 focus:ring-3 focus:ring-ring/20 disabled:bg-muted disabled:text-muted-foreground",
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
        "w-full resize-y rounded-md border border-input/70 bg-background/55 p-2.5 text-[13px] font-semibold text-foreground shadow-[0_1px_0_rgba(255,255,255,0.02)_inset] outline-none transition-colors hover:border-input focus:border-primary/70 focus:ring-3 focus:ring-ring/20 disabled:bg-muted disabled:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Select } from "@/components/ui/dropdown";
