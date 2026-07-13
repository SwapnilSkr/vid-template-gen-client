import { Play } from "lucide-react";
import { mediaUrl, type Reel } from "@/api/reels";
import { EditorPanel } from "@/components/studio/EditorPanel";
import { Button } from "@/components/ui/button";

export function ProgramMonitor({
  reel,
  previewUrl,
  fallbackPreviewUrl,
  variantPreview,
  onClearVariantPreview,
}: {
  reel: Reel;
  previewUrl?: string;
  /** Static Reddit opening composition shown before an MP4 exists. */
  fallbackPreviewUrl?: string;
  variantPreview?: boolean;
  onClearVariantPreview?: () => void;
}) {
  return (
    <EditorPanel
      title={
        variantPreview
          ? "Program monitor · voice variant preview"
          : reel.editDraft
            ? "Program monitor · local draft"
            : "Program monitor"
      }
      icon={<Play size={15} />}
      actions={
        <div className="flex items-center gap-1.5">
          {variantPreview ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClearVariantPreview}
            >
              Back to output
            </Button>
          ) : null}
          <span className="rounded-full border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground">
            9:16
          </span>
        </div>
      }
      className="overflow-hidden"
    >
      <div className="grid place-items-center bg-black/20 p-4">
        {variantPreview ? (
          <p className="mb-2 max-w-[360px] text-center text-[11px] text-muted-foreground">
            Previewing a voice take. Click{" "}
            <span className="font-medium text-foreground">Use in studio</span>{" "}
            under Voice Variants to make it the reel output.
          </p>
        ) : null}
        {previewUrl ? (
          <div className="grid w-full max-w-[360px] place-items-center">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              key={previewUrl}
              src={previewUrl}
              controls
              className="relative aspect-9/16 max-h-[50vh] w-full rounded-lg border border-border bg-black xl:max-h-[46vh]"
            />
          </div>
        ) : fallbackPreviewUrl ? (
          <div className="grid w-[min(100%,248px)] place-items-center">
            <img
              src={fallbackPreviewUrl}
              alt="Planned Reddit opening cover"
              className="relative aspect-9/16 w-full rounded-lg border border-border bg-black object-contain"
            />
            <span className="mt-2 text-center text-[11px] text-muted-foreground">
              Opening-cover preview · gameplay remains live after generation
            </span>
          </div>
        ) : (
          <div className="grid aspect-9/16 max-h-[50vh] w-full max-w-[360px] place-items-center rounded-lg border border-border bg-black text-sm text-muted-foreground/80 xl:max-h-[46vh]">
            No preview yet
          </div>
        )}
      </div>
    </EditorPanel>
  );
}
