import { memo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface FrameRangeValues {
  startSec: string;
  endSec: string;
}

interface FrameRangeControlsProps {
  values: FrameRangeValues;
  onChange: (values: FrameRangeValues) => void;
  durationSec?: number;
  playheadSec?: number;
  disabled?: boolean;
}

export const FrameRangeControls = memo(function FrameRangeControls({
  values,
  onChange,
  durationSec,
  playheadSec,
  disabled,
}: FrameRangeControlsProps) {
  const setPreset = useCallback(
    (startSec: number, endSec: number) => {
      onChange({ startSec: String(startSec), endSec: String(endSec) });
    },
    [onChange]
  );

  const duration = durationSec ?? (parseFloat(values.endSec) || 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          className="min-h-8 px-2 text-xs"
          disabled={disabled}
          onClick={() => setPreset(0, Math.min(2, duration || 2))}
        >
          First 2s
        </Button>
        {durationSec != null && durationSec > 0 && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-8 px-2 text-xs"
            disabled={disabled}
            onClick={() => setPreset(0, durationSec)}
          >
            Full video
          </Button>
        )}
        {playheadSec != null && (
          <Button
            type="button"
            variant="ghost"
            className="min-h-8 px-2 text-xs"
            disabled={disabled}
            onClick={() =>
              setPreset(
                playheadSec,
                Math.min(playheadSec + 2, durationSec ?? playheadSec + 2)
              )
            }
          >
            Playhead + 2s
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">From (sec)</span>
          <Input
            type="number"
            min={0}
            step={0.1}
            value={values.startSec}
            disabled={disabled}
            onChange={(e) => onChange({ ...values, startSec: e.target.value })}
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">To (sec)</span>
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder={durationSec != null ? String(durationSec) : "end"}
            value={values.endSec}
            disabled={disabled}
            onChange={(e) => onChange({ ...values, endSec: e.target.value })}
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Leave &quot;To&quot; empty to extract through the end of the video.
      </p>
    </div>
  );
});

export function parseFrameRange(values: FrameRangeValues, durationSec?: number) {
  const startSec = parseFloat(values.startSec);
  const endRaw = values.endSec.trim();
  const endSec = endRaw ? parseFloat(endRaw) : durationSec;
  if (Number.isNaN(startSec) || startSec < 0) {
    throw new Error("Enter a valid start time in seconds");
  }
  if (endSec != null && (Number.isNaN(endSec) || endSec <= startSec)) {
    throw new Error("End time must be after start time");
  }
  return {
    startSec,
    ...(endSec != null && !Number.isNaN(endSec) ? { endSec } : {}),
  };
}
