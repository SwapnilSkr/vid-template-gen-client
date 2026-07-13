import { Layers } from "lucide-react";
import type { Reel, Scene } from "@/api/reels";
import { EditorPanel } from "@/components/studio/EditorPanel";
import { ReelContextBar } from "@/components/studio/ReelContextBar";
import { SceneThumb } from "@/components/studio/SceneThumb";
import { cn } from "@/lib/utils";

export function ProjectPanel({
  reel,
  seriesReels,
  currentId,
  scenes,
  selectedSceneIndex,
  onSelectScene,
  onDeletePart,
  onMoveBoundary,
  onMergePart,
  partActionsDisabled,
}: {
  reel: Reel;
  seriesReels: Reel[];
  currentId: string;
  scenes: Scene[];
  selectedSceneIndex: number;
  onSelectScene: (index: number) => void;
  onDeletePart: (part: Reel) => void;
  onMoveBoundary: (direction: "pushLastToNext" | "pullFirstFromNext") => void;
  onMergePart: () => void;
  partActionsDisabled: boolean;
}) {
  return (
    <EditorPanel
      title="Project"
      icon={<Layers size={15} />}
      className="overflow-hidden xl:max-h-[calc(100vh-73px)]"
    >
      <div className="grid min-w-0 gap-3 overflow-x-hidden p-3 xl:max-h-[calc(100vh-128px)] xl:overflow-y-auto">
        <ReelContextBar
          reel={reel}
          seriesReels={seriesReels}
          currentId={currentId}
          onDeletePart={onDeletePart}
          onMoveBoundary={onMoveBoundary}
          onMergePart={onMergePart}
          partActionsDisabled={partActionsDisabled}
        />
        <div className="grid gap-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Scene bin</span>
            <span>{scenes.length} clips</span>
          </div>
          <div className="grid gap-1.5">
            {scenes.map((scene) => (
              <button
                key={scene.index}
                type="button"
                onClick={() => onSelectScene(scene.index)}
                className={cn(
                  "grid grid-cols-[42px_1fr] items-center gap-2 rounded-md border p-1.5 text-left transition-colors",
                  selectedSceneIndex === scene.index
                    ? "border-primary/70 bg-primary/10"
                    : "border-border bg-background hover:border-input hover:bg-accent",
                )}
              >
                <SceneThumb reel={reel} scene={scene} className="w-[42px]" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-foreground">
                    {String(scene.index + 1).padStart(2, "0")} ·{" "}
                    {scene.narration || "Untitled beat"}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground/80">
                    {scene.motion.type}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </EditorPanel>
  );
}

