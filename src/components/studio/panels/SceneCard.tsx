import { Image as ImageIcon, Loader2, Play, Trash2, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  mediaUrl,
  regenerateScene,
  removeScene,
  updateScene,
  type Reel,
  type Scene,
} from "@/api/reels";
import type { ConfirmAction, StudioRun } from "@/components/studio/types";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MOTION_MODES } from "@/constants/reels";
import { cn } from "@/lib/utils";

export function SceneCard({
  reelId,
  reel,
  scene,
  total,
  busy,
  disabled,
  isGameplay,
  run,
  requestConfirm,
}: {
  reelId: string;
  reel: Reel;
  scene: Scene;
  total: number;
  busy: boolean;
  disabled: boolean;
  isGameplay: boolean;
  run: StudioRun;
  requestConfirm: (action: ConfirmAction) => void;
}) {
  const [narration, setNarration] = useState(scene.narration);
  const [visualPrompt, setVisualPrompt] = useState(scene.visualPrompt);
  const dirty = isGameplay
    ? narration !== scene.narration
    : narration !== scene.narration || visualPrompt !== scene.visualPrompt;

  useEffect(() => {
    setNarration(scene.narration);
    setVisualPrompt(scene.visualPrompt);
  }, [scene.narration, scene.visualPrompt]);

  const disableAll = busy || disabled;
  const draftAsset = reel.editDraft?.sceneAssets.find(
    (item) => item.index === scene.index,
  );
  const imageUrl = mediaUrl(draftAsset?.assetUrl) ?? scene.assetUrl;
  const audioUrl = mediaUrl(draftAsset?.audioUrl) ?? scene.audioUrl;

  return (
    <div className="grid min-w-0 gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-[120px_minmax(0,1fr)]">
      <div className="grid gap-1.5">
        <div className="grid aspect-9/16 w-full place-items-center overflow-hidden rounded-md border border-border bg-black/45 text-muted-foreground/80">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`Scene ${scene.index + 1}`}
              className="h-full w-full object-cover"
            />
          ) : isGameplay ? (
            <span className="px-2 text-center text-[10px] leading-snug">Gameplay bg</span>
          ) : (
            <ImageIcon size={20} />
          )}
        </div>
        <span className="text-center text-[11px] font-medium text-muted-foreground/80">
          {isGameplay ? `Sentence ${scene.index + 1}/${total}` : `Scene ${scene.index + 1}/${total}`}
        </span>
        {audioUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio src={audioUrl} controls className="h-7 w-full" />
        ) : (
          <span className="inline-flex items-center justify-center gap-1 text-[11px] text-muted-foreground/80">
            <Play size={11} /> no audio
          </span>
        )}
      </div>

      <div className="grid min-w-0 gap-2 overflow-hidden">
        <Label className="gap-1 text-xs text-muted-foreground">
          Narration
          <Textarea
            rows={3}
            value={narration}
            disabled={disableAll}
            onChange={(e) => setNarration(e.target.value)}
          />
        </Label>
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
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {!isGameplay ? (
            <Select
              className="h-8 w-full text-xs sm:w-auto"
              disabled={disableAll}
              value={scene.motion.type}
              onChange={(e) =>
                void run(() =>
                  updateScene(reelId, scene.index, {
                    motion: {
                      ...scene.motion,
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
                  scene.index,
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
                    title: `Regenerate image for scene ${scene.index + 1}?`,
                    body: "This makes one new OpenRouter image request, then rebuilds the preview video with existing narration and other scene assets.",
                    details: [
                      "Costs image generation for this scene only.",
                      "Keeps every other scene image.",
                      "Keeps all narration audio.",
                      "Re-burns captions/render output so the preview reflects the new image.",
                    ],
                    confirmLabel: "Regenerate image",
                    onConfirm: () =>
                      run(() => regenerateScene(reelId, scene.index, ["image"])),
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
                    title: `Regenerate narration for scene ${scene.index + 1}?`,
                    body: "This makes one new OpenRouter TTS request, then rebuilds the preview video with existing images and other scene audio.",
                    details: [
                      "Costs narration generation for this scene only.",
                      "Keeps every scene image.",
                      "Keeps other scenes' narration audio.",
                      "Caption timing is rebuilt from the new audio duration.",
                    ],
                    confirmLabel: "Regenerate audio",
                    onConfirm: () =>
                      run(() => regenerateScene(reelId, scene.index, ["audio"])),
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
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={disableAll}
              onClick={() =>
                requestConfirm({
                  title: `Remove ${isGameplay ? "sentence" : "scene"} ${scene.index + 1}?`,
                  body: isGameplay
                    ? "This removes the sentence from the spoken body. It does not call OpenRouter by itself."
                    : "This removes the scene from the reel plan. It does not call OpenRouter by itself.",
                  confirmLabel: isGameplay ? "Remove sentence" : "Remove scene",
                  variant: "destructive",
                  onConfirm: () => run(() => removeScene(reelId, scene.index)),
                })
              }
            >
              <Trash2 size={15} />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

