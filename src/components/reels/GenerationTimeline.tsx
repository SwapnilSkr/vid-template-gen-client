import { CheckCircle2 } from "lucide-react";
import type { Reel } from "@/api/reels";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { GENERATION_STAGES } from "@/constants/reels";
import { cn } from "@/lib/utils";
import { isStageDone } from "@/utils/reel";

interface GenerationTimelineProps {
  reel?: Reel;
}

export function GenerationTimeline({ reel }: GenerationTimelineProps) {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Generation Timeline</PanelTitle>
        {reel?.createdAt ? (
          <span className="text-xs text-muted-foreground">Created {new Date(reel.createdAt).toLocaleString()}</span>
        ) : null}
      </PanelHeader>

      <div className="grid grid-cols-1 gap-2 px-3.5 pb-4 pt-4 sm:grid-cols-5">
        {GENERATION_STAGES.map((stage, index) => {
          const done = isStageDone(reel, index);
          const active = reel && !done && isStageDone(reel, index - 1);

          return (
            <div key={stage} className="grid justify-items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-full bg-card text-muted-foreground",
                  done && "text-primary",
                  active && "border-2 border-primary"
                )}
              >
                {done ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <span className="block h-2.5 w-2.5 rounded-full bg-border" />
                )}
              </span>
              <strong className="text-xs text-foreground/80">{stage}</strong>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
