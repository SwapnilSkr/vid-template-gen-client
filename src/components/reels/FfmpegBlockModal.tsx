import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CaptionSmokeButton } from "@/components/reels/CaptionSmokeDialog";
import {
  DEFAULT_FFMPEG_FIX_HINTS,
  type FfmpegCapability,
} from "@/api/reels";

/** Blocking modal when the API host cannot burn captions (no ffmpeg / libass / fonts). */
export function FfmpegBlockModal({
  capability,
  onClose,
}: {
  capability?: FfmpegCapability | null;
  onClose: () => void;
}) {
  if (!capability || capability.ok) return null;

  const hints =
    capability.fixHints.length > 0
      ? capability.fixHints
      : DEFAULT_FFMPEG_FIX_HINTS;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4">
      <div className="grid w-full max-w-md gap-3 rounded-lg border border-destructive/40 bg-card p-4 shadow-pop">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <strong className="text-base text-destructive">FFmpeg required</strong>
            <p className="m-0 text-sm leading-relaxed text-muted-foreground">
              {capability.message}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground hover:bg-accent"
          >
            <X size={16} />
          </Button>
        </div>
        <div className="grid gap-1 rounded-md border border-border bg-background p-2.5 text-xs text-muted-foreground">
          <div>
            ffmpeg: {capability.ffmpegOk ? "ok" : "missing"} · libass:{" "}
            {capability.hasAssFilter ? "ok" : "missing"} · fonts:{" "}
            {capability.fontsOk ? `${capability.fontCount} ready` : "missing"}
          </div>
          {hints.map((hint) => (
            <div key={hint} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
              <span>{hint}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <CaptionSmokeButton size="sm" variant="outline" label="Run smoke test" />
          <Button type="button" variant="destructive" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
