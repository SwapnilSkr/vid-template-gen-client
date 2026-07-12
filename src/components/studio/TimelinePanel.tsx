import { ChevronLeft, ChevronRight, Scissors, Volume2, Image as ImageIcon, Play, Trash2, AlignLeft } from "lucide-react";
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
        <div className="grid min-w-0 pl-0 pt-0 pb-0 pr-0 bg-[#1e1c26] rounded-t-md border-b border-border">
          {/* Text Track */}
          <div className="grid min-w-0 grid-cols-[80px_minmax(0,1fr)] items-center border-b border-[#352f4a]">
            <div className="flex h-10 items-center justify-center gap-2 border-r border-[#352f4a]">
              <AlignLeft size={16} className="text-[#a855f7]" />
            </div>
            <div className="flex h-full items-center min-w-0 overflow-x-auto relative ml-4 mr-4 studio-scrollbar">
              <div className="flex w-max gap-0 h-full">
                 {scenes.map((scene) => (
                    <button
                      key={`text-${scene.index}`}
                      type="button"
                      onClick={() => onSelectScene(scene.index)}
                      style={{ width: clipWidth(scene) }}
                      className={cn(
                        "relative flex items-center h-full rounded-none px-2 text-left transition-colors border-r border-black/20",
                        selectedSceneIndex === scene.index
                          ? "bg-gradient-to-b from-[#a855f7] to-[#7e22ce] border-t-2 border-l-2 border-r-2 border-white/60 z-20"
                          : "bg-gradient-to-b from-[#7e22ce] to-[#6b21a8] opacity-90",
                      )}
                    >
                      <span className="truncate text-[11px] font-medium text-white">
                        {scene.narration || "No text"}
                      </span>
                    </button>
                 ))}
               </div>
            </div>
          </div>

          {/* Main videos Track */}
          <div className="grid min-w-0 grid-cols-[80px_minmax(0,1fr)] items-center border-b border-[#352f4a]">
            <div className="flex h-10 items-center justify-center gap-2 border-r border-[#352f4a]">
              <ImageIcon size={16} className="text-[#14b8a6]" />
            </div>
            <div className="flex h-full items-center min-w-0 overflow-x-auto relative ml-4 mr-4 studio-scrollbar">
              <div className="flex w-max h-full gap-0">
                 {scenes.map((scene) => (
                    <button
                      key={`video-${scene.index}`}
                      type="button"
                      onClick={() => onSelectScene(scene.index)}
                      style={{ width: clipWidth(scene) }}
                      className={cn(
                        "group relative flex items-center h-full overflow-hidden border-r border-black/20 text-left transition-colors rounded-none",
                        selectedSceneIndex === scene.index
                          ? "bg-gradient-to-b from-[#14b8a6] to-[#0d9488] border-l-2 border-r-2 border-white/60 z-20"
                          : "bg-gradient-to-b from-[#0d9488] to-[#0f766e]",
                      )}
                    >
                      <SceneThumb reel={reel} scene={scene} className="absolute inset-0 w-full h-full object-cover rounded-none z-10 border-none bg-transparent" />
                      
                      <div className="absolute inset-0 z-20 hidden group-hover:flex items-center justify-center bg-black/60">
                        <span className="truncate text-[11px] font-medium text-white opacity-95">
                          Scene {scene.index + 1}
                        </span>
                      </div>
                    </button>
                 ))}
              </div>
            </div>
          </div>

          {/* Audio Track */}
          <div className="grid min-w-0 grid-cols-[80px_minmax(0,1fr)] items-center">
            <div className="flex h-10 items-center justify-center gap-2 border-r border-[#352f4a]">
              <Volume2 size={16} className="text-[#10b981]" />
            </div>
            <div className="flex h-full items-center min-w-0 overflow-x-auto relative ml-4 mr-4 studio-scrollbar">
              <div className="flex w-max gap-0 h-full">
                 {scenes.map((scene) => (
                    <button
                      key={`audio-${scene.index}`}
                      type="button"
                      onClick={() => onSelectScene(scene.index)}
                      style={{ width: clipWidth(scene) }}
                      className={cn(
                        "relative flex items-center h-full rounded-none px-2 text-left transition-colors border-r border-black/20",
                        selectedSceneIndex === scene.index
                          ? "bg-gradient-to-b from-[#10b981] to-[#059669] border-b-2 border-l-2 border-r-2 border-white/60 z-20"
                          : "bg-gradient-to-b from-[#059669] to-[#047857] opacity-90",
                      )}
                    >
                      <span className="truncate text-[11px] font-medium text-white">
                        Audio {scene.index + 1}
                      </span>
                    </button>
                 ))}
              </div>
            </div>
          </div>
        </div>

        {selectedScene ? (
          <div className="flex-1 border-t border-border bg-muted/20 p-3 pt-4">
            <div className="grid min-w-0 grid-cols-2 gap-4 overflow-hidden">
              <div className="grid gap-2 min-w-0">
                <Label className="gap-1 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Narration
                </Label>
                <Textarea
                  rows={4}
                  value={narration}
                  disabled={disableAll}
                  onChange={(e) => setNarration(e.target.value)}
                  className="resize-none h-full"
                />
              </div>
              {!isGameplay ? (
                <div className="grid gap-2 min-w-0">
                  <Label className="gap-1 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Visual prompt
                  </Label>
                  <Textarea
                    rows={4}
                    value={visualPrompt}
                    disabled={disableAll}
                    onChange={(e) => setVisualPrompt(e.target.value)}
                    className="resize-none h-full"
                  />
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex min-w-0 flex-wrap items-center gap-1.5">
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
        ) : (
          <div className="flex-1 grid place-items-center border-t border-border bg-muted/20 p-8 text-sm text-muted-foreground">
            No scenes yet.
          </div>
        )}
      </div>
    </EditorPanel>
  );
}
