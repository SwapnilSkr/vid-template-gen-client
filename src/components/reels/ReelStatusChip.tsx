import type { ReelStatus } from "@/api/reels";
import { cn } from "@/lib/utils";

export function reelStatusLabel(status: ReelStatus): string {
  if (status === "plan_review") return "awaiting review";
  return status.replace(/_/g, " ");
}

function reelStatusTone(status: ReelStatus): string {
  if (status === "completed") {
    return "border-success/40 bg-success/15 text-success";
  }
  if (status === "failed") {
    return "border-destructive/45 bg-destructive/12 text-destructive";
  }
  if (status === "plan_review") {
    return "border-warning/45 bg-warning/15 text-warning";
  }
  return "border-primary/40 bg-primary/10 text-primary";
}

interface ReelStatusChipProps {
  status: ReelStatus;
  size?: "sm" | "md";
  label?: string;
  className?: string;
}

/** Status pill used on overview tables and Studio headers. */
export function ReelStatusChip({
  status,
  size = "md",
  label,
  className,
}: ReelStatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex justify-center rounded-full border capitalize leading-none",
        size === "md" &&
          "min-w-[86px] px-2.5 py-1 text-[11px] font-medium tracking-normal",
        size === "sm" && "w-fit px-2 py-0.5 text-[10px] font-medium",
        reelStatusTone(status),
        className,
      )}
    >
      {label ?? reelStatusLabel(status)}
    </span>
  );
}
