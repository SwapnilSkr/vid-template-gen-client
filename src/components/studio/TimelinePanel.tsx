import { ChevronLeft, ChevronRight, Scissors, Volume2, Image as ImageIcon, Play, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { reorderScenes, updateScene, regenerateScene, removeScene, type Reel, type Scene } from "@/api/reels";
import { EditorPanel } from "@/components/studio/EditorPanel";
import { SceneThumb } from "@/components/studio/SceneThumb";
import type { ConfirmAction, StudioRun } from "@/components/studio/types";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function TimelinePanel({
  reelId,
  reel,
  scenes,
  selectedSceneIndex,
  onSelectScene,
  busy,
  disabled,
  isGameplay,
  requestConfirm,
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
  isGameplay: boolean;
  requestConfirm: (action: ConfirmAction) => void;
  onAddScene: () => void;
  run: StudioRun;
}) {
  const totalDuration = scenes.reduce((sum, scene) => sum + Math.max(scene.duration || 0, 0), 0);
  const clipWidth = (scene: Scene) => {
    if (!totalDuration) return 132;
    const share = Math.max(scene.duration || 0, 0) / totalDuration;
    return Math.round(Math.min(Math.max(share * scenes.length * 132, 104), 260));
  };
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

  const selectedScene = scenes[selectedSceneIndex];
  const [narration, setNarration] = useState(selectedScene?.narration || "");
  const [visualPrompt, setVisualPrompt] = useState(selectedScene?.visualPrompt || "");
  const dirty = isGameplay
    ? narration !== selectedScene?.narration
    : narration !== selectedScene?.narration || visualPrompt !== selectedScene?.visualPrompt;

  useEffect(() => {
    if (selectedScene) {
      setNarration(selectedScene.narration || "");
      setVisualPrompt(selectedScene.visualPrompt || "");
    }
  }, [selectedScene]);

  const disableAll = busy || disabled;
  const total = scenes.length;

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
      <div className="flex h-full flex-col">
        <div className="grid min-w-0 gap-2 p-3 pb-4">
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

        {selectedScene ? (
          <div className="flex-1 border-t border-border bg-muted/20 p-3 pt-4">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Narration
            </h3>
            <div className="grid min-w-0 gap-2 overflow-hidden">
              <Label className="gap-1 text-xs text-muted-foreground sr-only">
                Narration text
              </Label>
              <Textarea
                rows={3}
                value={narration}
                disabled={disableAll}
                onChange={(e) => setNarration(e.target.value)}
              />
              {!isGameplay ? (
                <Label className="gap-1 text-xs text-muted-foreground">
                  Visual prompt
                  <Textarea
                    rows={2}
                    value={visualPrompt}
                    disabled={disableAll}
                    onChange={(e) => setVisualPrompt(e.target.value)}
                  />
                </Label>
              ) : null}
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                {!isGameplay ? (
                  <Select
                    className="h-8 w-full text-xs sm:w-auto"
                    disabled={disableAll}
                    value={selectedScene.motion.type}
                    onChange={(e) =>
                      void run(() =>
                        updateScene(reelId, selectedScene.index, {
                          motion: {
                            ...selectedScene.motion,
                            type: e.target.value as Scene["motion"]["type"],
                          },
                        }),
                      )
                    }
                  >
                    <option value="ken_burns">Ken Burns</option>
                    <option value="parallax">Parallax</option>
                    <option value="static">Static</option>
                    <option value="ai_motion">AI motion</option>
                  </Select>
                ) : null}
                <Button
                  type="button"
                  size="default"
                  variant={dirty ? "default" : "outline"}
                  disabled={disableAll || !dirty}
                  onClick={() =>
                    void run(() =>
                      updateScene(
                        reelId,
                        selectedScene.index,
                        isGameplay ? { narration } : { narration, visualPrompt },
                      ),
                    )
                  }
                >
                  {dirty ? "Save" : "Saved"}
                </Button>
                {!isGameplay ? (
                  <>
                    <Button
                      type="button"
                      size="default"
                      variant="outline"
                      className="border-border bg-secondary text-foreground hover:bg-accent"
                      disabled={disableAll}
                      title="Regenerate this scene's image"
                      onClick={() =>
                        requestConfirm({
                          title: `Regenerate image for scene ${selectedScene.index + 1}?`,
                          body: "This makes one new OpenRouter image request, then rebuilds the preview video with existing narration and other scene assets.",
                          details: [
                            "Costs image generation for this scene only.",
                            "Keeps every other scene image.",
                            "Keeps all narration audio.",
                            "Re-burns captions/render output so the preview reflects the new image.",
                          ],
                          confirmLabel: "Regenerate image",
                          onConfirm: () =>
                            run(() => regenerateScene(reelId, selectedScene.index, ["image"])),
                        })
                      }
                    >
                      <ImageIcon size={13} /> Image
                    </Button>
                    <Button
                      type="button"
                      size="default"
                      variant="outline"
                      className="border-border bg-secondary text-foreground hover:bg-accent"
                      disabled={disableAll}
                      title="Regenerate this scene's narration audio"
                      onClick={() =>
                        requestConfirm({
                          title: `Regenerate narration for scene ${selectedScene.index + 1}?`,
                          body: "This makes one new OpenRouter TTS request, then rebuilds the preview video with existing images and other scene audio.",
                          details: [
                            "Costs narration generation for this scene only.",
                            "Keeps every scene image.",
                            "Keeps other scenes' narration audio.",
                            "Caption timing is rebuilt from the new audio duration.",
                          ],
                          confirmLabel: "Regenerate audio",
                          onConfirm: () =>
                            run(() => regenerateScene(reelId, selectedScene.index, ["audio"])),
                        })
                      }
                    >
                      <Play size={13} /> Audio
                    </Button>
                  </>
                ) : null}
                {total > 1 ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={disableAll}
                    onClick={() =>
                      requestConfirm({
                        title: `Remove ${isGameplay ? "sentence" : "scene"} ${selectedScene.index + 1}?`,
                        body: isGameplay
                          ? "This removes the sentence from the spoken body. It does not call OpenRouter by itself."
                          : "This removes the scene from the reel plan. It does not call OpenRouter by itself.",
                        confirmLabel: isGameplay ? "Remove sentence" : "Remove scene",
                        variant: "destructive",
                        onConfirm: () => run(() => removeScene(reelId, selectedScene.index)),
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 grid place-items-center border-t border-border bg-muted/20 p-8 text-sm text-muted-foreground">
            No scenes yet.
          </div>
        )}
      </div>
    </EditorPanel>
  );
}
