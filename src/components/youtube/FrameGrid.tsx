import { memo } from "react";
import { frameUrlForImport, type YtImport } from "@/api/yt-imports";
import { cn } from "@/lib/utils";

interface FrameGridProps {
  item: Pick<YtImport, "_id" | "frameDelivery">;
  frames: number[];
  selectedFrame?: number;
  onSelectFrame: (index: number) => void;
}

const FrameCell = memo(function FrameCell({
  item,
  index,
  selected,
  onSelect,
}: {
  item: Pick<YtImport, "_id" | "frameDelivery">;
  index: number;
  selected: boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      className={cn(
        "min-h-[52px] overflow-hidden rounded border border-border/60 bg-muted transition ring-primary",
        selected && "ring-2"
      )}
    >
      <img
        src={frameUrlForImport(item, index)}
        alt={`Frame ${index}`}
        className="aspect-video w-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </button>
  );
});

export const FrameGrid = memo(function FrameGrid({
  item,
  frames,
  selectedFrame,
  onSelectFrame,
}: FrameGridProps) {
  if (frames.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Frame files are still syncing — this refreshes automatically.
      </p>
    );
  }

  return (
    <div className="grid max-h-[360px] grid-cols-4 gap-2 overflow-auto sm:grid-cols-6">
      {frames.map((idx) => (
        <FrameCell
          key={idx}
          item={item}
          index={idx}
          selected={selectedFrame === idx}
          onSelect={onSelectFrame}
        />
      ))}
    </div>
  );
});
