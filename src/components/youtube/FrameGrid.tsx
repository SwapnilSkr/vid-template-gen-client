import { memo } from "react";
import { frameUrl } from "@/api/yt-imports";
import { cn } from "@/lib/utils";

interface FrameGridProps {
  importId: string;
  frames: number[];
  selectedFrame?: number;
  onSelectFrame: (index: number) => void;
}

const FrameCell = memo(function FrameCell({
  importId,
  index,
  selected,
  onSelect,
}: {
  importId: string;
  index: number;
  selected: boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      className={cn(
        "overflow-hidden rounded border border-border/60 bg-muted transition ring-primary [content-visibility:auto]",
        selected && "ring-2"
      )}
    >
      <img
        src={frameUrl(importId, index)}
        alt={`Frame ${index}`}
        className="aspect-video w-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </button>
  );
});

export const FrameGrid = memo(function FrameGrid({
  importId,
  frames,
  selectedFrame,
  onSelectFrame,
}: FrameGridProps) {
  return (
    <div className="grid max-h-[360px] grid-cols-4 gap-2 overflow-auto sm:grid-cols-6 contain-strict">
      {frames.map((idx) => (
        <FrameCell
          key={idx}
          importId={importId}
          index={idx}
          selected={selectedFrame === idx}
          onSelect={onSelectFrame}
        />
      ))}
    </div>
  );
});
