import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Film,
  MoreVertical,
} from "lucide-react";
import type { Reel } from "@/api/reels";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { useReelStudio } from "@/store/reel-studio";
import { formatLabel, reelId } from "@/utils/reel";

interface VideoPreviewProps {
  reel?: Reel;
  reels?: Reel[];
  selectedId?: string;
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

  function reelOptionLabel(item: Reel, index: number) {
    const partLabel =
      (item.partCount ?? 1) > 1
        ? ` · Part ${item.partNumber ?? index + 1}/${item.partCount}`
        : "";
    return `${String(index + 1).padStart(2, "0")} · ${item.title || item.topic || "Untitled reel"} · ${formatLabel(item.genre)}${partLabel}`;
  }

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
          ) : (
            <div className="grid h-full place-items-center gap-2 px-4 text-center text-muted-foreground">
              <Film size={46} />
              <strong className="text-foreground">
                {reel
                  ? `${reel.progress}% generated`
                  : "Select or create a reel"}
              </strong>
              <span className="text-[13px] text-muted-foreground">
                Completed reels appear here for review.
              </span>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
