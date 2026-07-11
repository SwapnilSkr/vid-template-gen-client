import { ChevronLeft, ChevronRight, Scissors, Volume2 } from "lucide-react";
import { reorderScenes, type Reel, type Scene } from "@/api/reels";
import { EditorPanel } from "@/components/studio/EditorPanel";
import { SceneThumb } from "@/components/studio/SceneThumb";
import type { StudioRun } from "@/components/studio/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TimelinePanel({
  reelId,
  reel,
  scenes,
  selectedSceneIndex,
  onSelectScene,
  busy,
  disabled,
  onAddScene,
  run,
}: {
  reelId: string;
  reel: Reel;
  scenes: Scene[];
  selectedSceneIndex: number;
  onSelectScene: (index: number) => void;
  busy: boolean;
  disabled: boolean;
  onAddScene: () => void;
  run: StudioRun;
}) {
  const totalDuration = scenes.reduce((sum, scene) => sum + Math.max(scene.duration || 0, 0), 0);
  // Clip width tracks real duration so the timeline reads like an NLE — clamped
  // so tiny scenes stay clickable and one long scene can't crowd out the rest.
  const clipWidth = (scene: Scene) => {
    if (!totalDuration) return 132;
    const share = Math.max(scene.duration || 0, 0) / totalDuration;
    return Math.round(Math.min(Math.max(share * scenes.length * 132, 104), 260));
  };
  // order[newPos] = oldPos — swap adjacent positions to move a scene.
  const moveScene = (from: number, to: number) => {
    if (to < 0 || to >= scenes.length) return;
    const order = scenes.map((_, i) => i);
    [order[from], order[to]] = [order[to], order[from]];
    void run(async () => {
      const next = await reorderScenes(reelId, order);
      onSelectScene(to);
      return next;
    });
  };

  return (
    <EditorPanel
      title={`Timeline · ${totalDuration.toFixed(1)}s`}
      icon={<Scissors size={15} />}
      actions={
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={busy || disabled || selectedSceneIndex <= 0}
            title="Move selected scene earlier"
            onClick={() => moveScene(selectedSceneIndex, selectedSceneIndex - 1)}
          >
            <ChevronLeft size={15} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={busy || disabled || selectedSceneIndex >= scenes.length - 1}
            title="Move selected scene later"
            onClick={() => moveScene(selectedSceneIndex, selectedSceneIndex + 1)}
          >
            <ChevronRight size={15} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || disabled}
            onClick={onAddScene}
          >
            + Add {reel.strategy === "gameplay_overlay" ? "sentence" : "scene"}
          </Button>
        </div>
      }
    >
      <div className="grid min-w-0 gap-2 p-3">
        <div className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)] items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
            Video
          </span>
          <div className="studio-scrollbar min-w-0 overflow-x-auto pb-1">
            <div className="flex w-max gap-1.5">
              {scenes.map((scene) => (
                <button
                  key={scene.index}
                  type="button"
                  onClick={() => onSelectScene(scene.index)}
                  style={{ width: clipWidth(scene) }}
                  className={cn(
                    "relative grid grid-cols-[34px_1fr] items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors",
                    selectedSceneIndex === scene.index
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:border-input",
                  )}
                >
                  <SceneThumb reel={reel} scene={scene} className="w-[34px]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-medium text-foreground">
                      Scene {scene.index + 1}
                    </span>
                    <span className="block text-[10px] tabular-nums text-muted-foreground/80">
                      {Math.max(scene.duration || 0, 0).toFixed(1)}s
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)] items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
            Audio
          </span>
          <div className="studio-scrollbar min-w-0 overflow-x-auto pb-1">
            <div className="flex w-max gap-1.5">
              {scenes.map((scene) => (
                <button
                  key={scene.index}
                  type="button"
                  onClick={() => onSelectScene(scene.index)}
                  style={{ width: clipWidth(scene) }}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-2 py-2 text-left transition-colors",
                    selectedSceneIndex === scene.index
                      ? "border-success/70 bg-success/10"
                      : "border-border bg-background hover:border-input",
                  )}
                >
                  <Volume2 size={14} className="shrink-0 text-success" />
                  <span className="truncate text-[11px] font-medium text-muted-foreground">
                    Narration {scene.index + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </EditorPanel>
  );
}

