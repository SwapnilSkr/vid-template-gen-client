import { CheckCircle2, Loader2 } from "lucide-react";
import type { Reel } from "@/api/reels";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { GENERATION_STAGES } from "@/constants/reels";
import { cn } from "@/lib/utils";
import {
  isStageActive,
  isStageDone,
  reelProgressLabel,
} from "@/utils/reel";

interface GenerationTimelineProps {
  reel?: Reel;
}

export function GenerationTimeline({ reel }: GenerationTimelineProps) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Generation Timeline</PanelTitle>
        {reel?.createdAt ? (
          <span className="text-xs text-muted-foreground">
            Created {new Date(reel.createdAt).toLocaleString()}
          </span>
        ) : null}
      </PanelHeader>

      <div className="flex flex-col gap-6 px-5 pb-6 pt-6 md:flex-row md:justify-between md:gap-0">
        {GENERATION_STAGES.map((stage, index) => {
          const done = isStageDone(reel, index);
          const nextDone = isStageDone(reel, index + 1);
          const active = reel && !done && isStageDone(reel, index - 1);
          const isLast = index === GENERATION_STAGES.length - 1;

          return (
            <div key={stage} className="relative flex flex-1 items-center gap-4 md:flex-col md:gap-2.5">
              {/* Connector line to the next step */}
              {!isLast && (
                <div className={cn(
                  "absolute left-4 top-8 bottom-[-24px] w-[2px] bg-zinc-800/80 transition-all duration-500 md:left-[calc(50%+16px)] md:right-[-50%] md:top-[15px] md:h-[2px] md:w-auto md:bottom-auto",
                  done && nextDone && "bg-indigo-500",
                  done && active && "bg-gradient-to-r from-indigo-500 to-zinc-800"
                )} />
              )}

              {/* Node bubble */}
              <span
                className={cn(
                  "relative z-10 grid h-8 w-8 place-items-center rounded-full bg-zinc-950 border border-zinc-800 text-muted-foreground transition-all duration-300",
                  done && "border-indigo-500 text-indigo-400 bg-indigo-500/5 shadow-[0_0_12px_rgba(97,110,216,0.2)]",
                  active && "border-indigo-400 text-indigo-300 bg-indigo-500/10 shadow-[0_0_15px_rgba(97,110,216,0.35)] scale-110"
                )}
              >
                {done ? (
                  <CheckCircle2 size={16} className="text-indigo-400" />
                ) : active ? (
                  <span className="block h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                ) : (
                  <span className="block h-2 w-2 rounded-full bg-zinc-700" />
                )}
              </span>

              {/* Step Info */}
              <div className="flex flex-col md:items-center">
                <span className={cn(
                  "text-xs font-semibold tracking-tight transition-colors duration-300",
                  (done || active) ? "text-foreground" : "text-muted-foreground"
                )}>
                  {stage}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {reel && reel.status !== "completed" ? (
        <div className="border-t border-border px-3.5 py-3 text-xs text-muted-foreground">
          {reel.status === "plan_review" ? (
            <span>
              Plan ready — review scenes in Studio, then generate assets.
            </span>
          ) : reel.status === "failed" ? (
            <span className="text-destructive">
              {reel.error?.trim() || "Generation failed."}
            </span>
          ) : (
            <span className="capitalize text-foreground">
              {reelProgressLabel(reel)}
            </span>
          )}
        </div>
      ) : null}
    </Panel>
  );
}
