import type { ReelCostBreakdown } from "@/api/reels";

const NON_AI_COST_LABEL = /Render \+ storage/i;

export function sanitizeAiCostBreakdown(
  breakdown?: ReelCostBreakdown,
): ReelCostBreakdown | undefined {
  if (!breakdown?.lines?.length) return breakdown;
  const lines = breakdown.lines.filter((line) => !NON_AI_COST_LABEL.test(line.label));
  if (!lines.length) return undefined;
  return {
    ...breakdown,
    lines,
    totalUsd: lines.reduce((sum, line) => sum + line.costUsd, 0),
  };
}
