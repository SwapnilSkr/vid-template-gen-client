import { Loader2 } from "lucide-react";
import { discardEditDraft, saveEditDraft, type Reel } from "@/api/reels";
import type { StudioRun } from "@/components/studio/types";
import { Button } from "@/components/ui/button";

export function EditDraftBanner({
  reel,
  busy,
  run,
}: {
  reel: Reel;
  busy: boolean;
  run: StudioRun;
}) {
  if (!reel.editDraft) return null;
  const reelKey = reel._id ?? reel.id ?? "";
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm text-warning">
      <div>
        <div className="font-semibold">Unsaved editor draft</div>
        <div className="text-xs">
          Preview assets are local only. Save uploads to S3 and removes replaced
          scene assets and the previous output video.
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="default"
          disabled={busy}
          onClick={() => void run(() => saveEditDraft(reelKey))}
        >
          Save changes
        </Button>
        <Button
          type="button"
          size="default"
          variant="outline"
          disabled={busy}
          onClick={() => void run(() => discardEditDraft(reelKey))}
        >
          Discard
        </Button>
      </div>
    </div>
  );
}

