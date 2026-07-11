import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Film,
  Loader2,
  MoreVertical,
} from "lucide-react";
import { mediaUrl, type Reel, type Scene } from "@/api/reels";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { useReelStudio } from "@/store/reel-studio";
import {
  formatLabel,
  reelId,
  reelProgressLabel,
  REEL_ACTIVE_STATUSES,
} from "@/utils/reel";

interface VideoPreviewProps {
  reel?: Reel;
  reels?: Reel[];
  selectedId?: string;
}

function reelOptionLabel(item: Reel, index: number) {
  const partLabel =
    (item.partCount ?? 1) > 1
      ? ` · Part ${item.partNumber ?? index + 1}/${item.partCount}`
      : "";
  return `${String(index + 1).padStart(2, "0")} · ${item.title || item.topic || "Untitled reel"} · ${formatLabel(item.genre)}${partLabel}`;
}

function previewStatusCopy(reel: Reel, isGenerating: boolean): string {
  if (reel.status === "plan_review") {
    return "Plan ready — open Studio to review, then generate.";
  }
  if (isGenerating) return "Assets appear here as each scene finishes.";
  return "Completed reels appear here for review.";
}

export function VideoPreview({
  reel,
  reels = [],
  selectedId,
}: VideoPreviewProps) {
  const setPreviewTimeSeconds = useReelStudio(
    (state) => state.setPreviewTimeSeconds,
  );
  const select = useReelStudio((state) => state.select);
  const selectedIndex = reels.findIndex((item) => reelId(item) === selectedId);
  const hasNavigator = reels.length > 1 && selectedIndex >= 0;
  const previousReel = hasNavigator ? reels[selectedIndex - 1] : undefined;
  const nextReel = hasNavigator ? reels[selectedIndex + 1] : undefined;
  const isGenerating = reel
    ? REEL_ACTIVE_STATUSES.includes(reel.status)
    : false;

  let sceneAssetCount = 0;
  let audioReady = 0;
  const sceneAssets: Scene[] = [];
  if (reel?.scenes) {
    for (const scene of reel.scenes) {
      if (scene.audioUrl) audioReady += 1;
      if (scene.assetUrl && !scene.isHero) {
        sceneAssetCount += 1;
        sceneAssets.push(scene);
      }
    }
  }
  const sceneTotal = reel?.scenes?.length ?? 0;

  return (
    <Panel className="grid h-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <PanelHeader>
        <div className="min-w-0">
          <PanelTitle>Reel Preview</PanelTitle>
          <span className="ml-1 rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
            9:16
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {hasNavigator ? (
            <div className="grid min-w-[260px] max-w-[520px] flex-1 grid-cols-[36px_minmax(0,1fr)_36px] items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Previous reel"
                disabled={!previousReel}
                onClick={() =>
                  previousReel && void select(reelId(previousReel))
                }
              >
                <ChevronLeft size={16} />
              </Button>
              <Select
                aria-label="Select reel preview"
                value={selectedId ?? ""}
                onChange={(event) =>
                  event.target.value && void select(event.target.value)
                }
              >
                {reels.map((item, index) => {
                  const id = reelId(item);
                  return (
                    <option key={id} value={id}>
                      {reelOptionLabel(item, index)}
                    </option>
                  );
                })}
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Next reel"
                disabled={!nextReel}
                onClick={() => nextReel && void select(reelId(nextReel))}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          ) : null}
          {reel?.outputUrl ? (
            <a
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-[13px] font-medium text-foreground no-underline"
              href={reel.outputUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open
              <ExternalLink size={15} />
            </a>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="More preview actions"
          >
            <MoreVertical size={16} />
          </Button>
        </div>
      </PanelHeader>

      <div className="m-3 flex min-h-60 items-center justify-center rounded-md border border-border bg-black/45 p-3 md:min-h-[300px]">
        <div className="aspect-9/16 h-[min(460px,52vh)] w-auto max-w-full overflow-hidden rounded-md border border-border bg-black">
          {reel?.outputUrl ? (
            <video
              className="h-full w-full object-contain"
              key={reel.outputUrl}
              src={reel.outputUrl}
              controls
              playsInline
              onLoadedMetadata={(event) =>
                setPreviewTimeSeconds(event.currentTarget.currentTime)
              }
              onSeeked={(event) =>
                setPreviewTimeSeconds(event.currentTarget.currentTime)
              }
              onTimeUpdate={(event) =>
                setPreviewTimeSeconds(event.currentTarget.currentTime)
              }
            />
          ) : sceneAssets.length > 0 && reel ? (
            <div className="grid h-full grid-rows-[minmax(0,1fr)_auto] gap-2 p-2">
              <div className="grid min-h-0 grid-cols-2 content-start gap-1.5 overflow-y-auto sm:grid-cols-3">
                {sceneAssets.map((scene) => {
                  const src = mediaUrl(scene.assetUrl);
                  if (!src) return null;
                  return (
                    <div
                      key={scene.index}
                      className="relative aspect-9/16 overflow-hidden rounded border border-border/70 bg-black/40"
                    >
                      <img
                        src={src}
                        alt={`Scene ${scene.index + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] text-white">
                        {scene.index + 1}
                        {scene.audioUrl ? " · ♪" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="grid gap-0.5 px-1 pb-1 text-center text-[12px] text-muted-foreground">
                <strong className="inline-flex items-center justify-center gap-1.5 text-foreground">
                  {isGenerating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : null}
                  {reel.currentStep ?? `${reel.progress}% generated`}
                </strong>
                <span>
                  {sceneAssetCount}/{sceneTotal || "?"} stills
                  {audioReady > 0 ? ` · ${audioReady} narration` : ""}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center gap-2 px-4 text-center text-muted-foreground">
              {isGenerating ? (
                <Loader2 size={40} className="animate-spin text-primary" />
              ) : (
                <Film size={46} />
              )}
              <strong className="text-foreground">
                {reel ? reelProgressLabel(reel) : "Select or create a reel"}
              </strong>
              <span className="text-[13px] text-muted-foreground">
                {reel
                  ? previewStatusCopy(reel, isGenerating)
                  : "Completed reels appear here for review."}
              </span>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
