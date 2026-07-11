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

      <div className="grid grid-cols-1 gap-2 px-3.5 pb-3 pt-4 sm:grid-cols-5">
        {GENERATION_STAGES.map((stage, index) => {
          const done = isStageDone(reel, index);
          const active = isStageActive(reel, index);

          return (
            <div
              key={stage}
              className="grid justify-items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-full bg-card text-muted-foreground",
                  done && "text-primary",
                  active && "border-2 border-primary text-primary",
                )}
              >
                {done ? (
                  <CheckCircle2 size={18} />
                ) : active ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <span className="block h-2.5 w-2.5 rounded-full bg-border" />
                )}
              </span>
              <strong
                className={cn(
                  "text-xs text-foreground/80",
                  active && "text-foreground",
                )}
              >
                {stage}
              </strong>
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
