import { Palette } from "lucide-react";
import { useEffect, useState } from "react";
import { listArtStyles, type ArtStyleOption, type Reel } from "@/api/reels";

export function StyleLookPanel({ reel }: { reel?: Reel }) {
  const [artStyles, setArtStyles] = useState<ArtStyleOption[]>([]);

  const isHorror = Boolean(
    reel && (reel.niche.startsWith("horror") || reel.artStyleId),
  );

  useEffect(() => {
    if (!isHorror) return;
    void listArtStyles("horror")
      .then(setArtStyles)
      .catch(() => setArtStyles([]));
  }, [isHorror]);

  if (!reel || !isHorror) return null;

  const artStyle = artStyles.find((s) => s.id === reel.artStyleId);
  const motionLabel = reel.motionMode?.replace(/_/g, " ") ?? "not set";

  return (
    <div className="grid gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Palette size={16} />
        Style &amp; Look
      </div>
      <div className="grid gap-1.5 text-xs">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-semibold text-muted-foreground">
            Art style
          </span>
          <span className="font-semibold text-foreground">
            {artStyle?.displayName ?? reel.artStyleId ?? "Auto (rotate)"}
          </span>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-semibold text-muted-foreground">Motion</span>
          <span className="font-medium capitalize text-foreground">
            {motionLabel}
          </span>
        </div>
        {reel.captionStyle?.fontName ? (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-semibold text-muted-foreground">
              Caption font
            </span>
            <span className="font-medium text-foreground">
              {reel.captionStyle.fontName}
            </span>
          </div>
        ) : null}
      </div>
      {artStyle?.thumbnailUrl ? (
        <img
          src={artStyle.thumbnailUrl}
          alt={artStyle.displayName}
          className="aspect-square w-20 rounded-md border border-border object-cover"
        />
      ) : null}
    </div>
  );
}
