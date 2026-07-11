import { Link } from "@tanstack/react-router";
import { Download, Image as ImageIcon } from "lucide-react";
import { apiUrl, mediaUrl, type Reel } from "@/api/reels";
import { buttonClassName } from "@/components/ui/button";
import { PanelTitle } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

export function ThumbnailPanel({ reel }: { reel: Reel }) {
  const reelKey = reel._id ?? reel.id ?? "";
  const draft = reel.thumbnailDraft;
  return (
    <div className="grid gap-2.5">
      <PanelTitle className="text-foreground">Thumbnail</PanelTitle>

      {reel.review?.thumbnailUrl ? (
        <img
          src={reel.review.thumbnailUrl}
          alt="Saved thumbnail"
          className="w-full rounded-md border border-border object-cover"
        />
      ) : (
        <div className="grid aspect-video w-full place-items-center gap-2 rounded-md border border-border bg-black/45 text-xs font-semibold text-muted-foreground/80">
          <ImageIcon size={24} />
          No thumbnail uploaded yet
        </div>
      )}

      {draft ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-warning/50 bg-warning/10 px-2.5 py-2 text-xs text-warning">
          <span className="font-medium">Staged local draft waiting</span>
          <span className="text-warning/80">upload or discard it in the studio</span>
        </div>
      ) : null}

      <Link
        to="/studio/$id/thumbnail"
        params={{ id: reelKey }}
        search={{ mode: undefined }}
        className={cn(buttonClassName("default"), "no-underline")}
      >
        <ImageIcon size={15} /> Open Thumbnail Studio
      </Link>
      <p className="text-[11px] text-muted-foreground/80">
        Frame grabs, scene stills, text overlay, aspect ratio, and AI generation all live in the
        dedicated Thumbnail Studio. Drafts stay local until uploaded to S3 or discarded.
        For Shorts, prefer 9:16 — the swipe feed still uses a video frame, not this image.
      </p>
    </div>
  );
}

// ---- Live caption editor ----
