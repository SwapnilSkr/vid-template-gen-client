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
        "min-h-[38px] w-full rounded-md border border-input bg-background/45 px-2.5 py-2 text-[13px] font-semibold text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-ring/20 disabled:bg-muted disabled:text-muted-foreground",
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
        "w-full resize-y rounded-md border border-input bg-background/45 p-2.5 text-[13px] font-semibold text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-ring/20 disabled:bg-muted disabled:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Select } from "@/components/ui/dropdown";
