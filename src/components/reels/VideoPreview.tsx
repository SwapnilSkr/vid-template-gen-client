import { ExternalLink, Film, MoreVertical } from "lucide-react";
import type { Reel } from "@/api/reels";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { useReelStudio } from "@/store/reel-studio";

interface VideoPreviewProps {
  reel?: Reel;
}

export function VideoPreview({ reel }: VideoPreviewProps) {
  const setPreviewTimeSeconds = useReelStudio((state) => state.setPreviewTimeSeconds);

  return (
    <Panel className="overflow-hidden">
      <PanelHeader>
        <div>
          <PanelTitle>Reel Preview</PanelTitle>
          <span className="ml-1 rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground">9:16</span>
        </div>
        <div className="flex items-center gap-2">
          {reel?.outputUrl ? (
            <a
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-[13px] font-bold text-foreground no-underline"
              href={reel.outputUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open
              <ExternalLink size={15} />
            </a>
          ) : null}
          <Button type="button" variant="outline" size="icon" aria-label="More preview actions">
            <MoreVertical size={16} />
          </Button>
        </div>
      </PanelHeader>

      <div className="m-3.5 flex min-h-60 items-center justify-center rounded-md border border-border bg-black/45 p-4 md:min-h-[310px]">
        <div className="aspect-9/16 h-[min(520px,70vh)] w-auto max-w-full overflow-hidden rounded-md border border-border bg-black">
          {reel?.outputUrl ? (
            <video
              className="h-full w-full object-contain"
              key={reel.outputUrl}
              src={reel.outputUrl}
              controls
              playsInline
              onLoadedMetadata={(event) => setPreviewTimeSeconds(event.currentTarget.currentTime)}
              onSeeked={(event) => setPreviewTimeSeconds(event.currentTarget.currentTime)}
              onTimeUpdate={(event) => setPreviewTimeSeconds(event.currentTarget.currentTime)}
            />
          ) : (
            <div className="grid h-full place-items-center gap-2 px-4 text-center text-muted-foreground">
              <Film size={46} />
              <strong className="text-foreground">
                {reel ? `${reel.progress}% generated` : "Select or create a reel"}
              </strong>
              <span className="text-[13px] text-muted-foreground">Completed reels appear here for review.</span>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
