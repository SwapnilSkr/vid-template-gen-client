import { Loader2, Plus, Scissors, Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { mediaUrl, trimFinishedVideo, type Reel } from "@/api/reels";
import { StudioDialog } from "@/components/studio/StudioDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CutDraft = { id: string; startSec: string; endSec: string };

function cutDraft(): CutDraft {
  return { id: `${Date.now()}-${Math.random()}`, startSec: "", endSec: "" };
}

function secondsLabel(value: number): string {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
}

/** A deliberately focused post-render editor: it removes arbitrary intervals,
 * leaves the story/TTS caches untouched, and delegates the safe S3 swap to the
 * server. This avoids a heavyweight timeline dependency for a simple cut job. */
export function FinalVideoTrimDialog({
  reel,
  onClose,
  onApplied,
}: {
  reel: Reel;
  onClose: () => void;
  onApplied: (reel: Reel) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [playhead, setPlayhead] = useState(0);
  const [cuts, setCuts] = useState<CutDraft[]>([cutDraft()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const updateCut = useCallback((id: string, field: "startSec" | "endSec", value: string) => {
    setCuts((current) => current.map((cut) => cut.id === id ? { ...cut, [field]: value } : cut));
  }, []);

  const setFromPlayhead = useCallback((id: string, field: "startSec" | "endSec") => {
    updateCut(id, field, playhead.toFixed(2));
  }, [playhead, updateCut]);

  const apply = useCallback(async () => {
    const ranges = cuts.map((cut) => ({ startSec: Number(cut.startSec), endSec: Number(cut.endSec) }));
    if (!ranges.length || ranges.some((cut) => !Number.isFinite(cut.startSec) || !Number.isFinite(cut.endSec) || cut.startSec < 0 || cut.endSec <= cut.startSec)) {
      setError("Every cut needs a valid in and out time, with out later than in.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const updated = await trimFinishedVideo(reel._id ?? reel.id ?? "", ranges);
      onApplied(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not trim the finished video");
    } finally {
      setSaving(false);
    }
  }, [cuts, onApplied, onClose, reel._id, reel.id]);

  const source = mediaUrl(reel.outputUrl);
  return (
    <StudioDialog title="Trim finished video" description="Remove any number of intervals. This replaces only the Studio's primary finished MP4; existing social posts are not edited." onClose={onClose}>
      <div className="grid gap-4">
        {source ? <div className="grid gap-2">
          <video ref={videoRef} src={source} controls playsInline className="mx-auto max-h-[44dvh] max-w-full rounded-md bg-black" onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onTimeUpdate={(event) => setPlayhead(event.currentTarget.currentTime)} />
          <p className="m-0 text-xs text-muted-foreground">Playhead: <strong className="text-foreground">{secondsLabel(playhead)}</strong>{duration ? ` / ${secondsLabel(duration)}` : ""}. Use it to mark a cut precisely.</p>
        </div> : null}

        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
          The old S3 finished-video object is reclaimed only after the edited replacement is uploaded and saved. Narration, subtitles, gameplay sources, and already published posts are left alone.
        </div>

        <div className="grid gap-3">
          {cuts.map((cut, index) => <div key={cut.id} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="grid gap-1 text-xs font-medium">Remove from (seconds)
              <div className="flex gap-1"><Input type="number" min="0" max={duration || undefined} step="0.01" value={cut.startSec} onChange={(event) => updateCut(cut.id, "startSec", event.target.value)} /><Button type="button" size="sm" variant="secondary" onClick={() => setFromPlayhead(cut.id, "startSec")}>Set</Button></div>
            </label>
            <label className="grid gap-1 text-xs font-medium">Remove to (seconds)
              <div className="flex gap-1"><Input type="number" min="0" max={duration || undefined} step="0.01" value={cut.endSec} onChange={(event) => updateCut(cut.id, "endSec", event.target.value)} /><Button type="button" size="sm" variant="secondary" onClick={() => setFromPlayhead(cut.id, "endSec")}>Set</Button></div>
            </label>
            <Button type="button" size="icon" variant="ghost" disabled={cuts.length === 1 || saving} className="text-destructive hover:text-destructive" aria-label={`Remove cut ${index + 1}`} onClick={() => setCuts((current) => current.filter((item) => item.id !== cut.id))}><Trash2 size={16} /></Button>
          </div>)}
          <Button type="button" variant="secondary" className="justify-self-start" disabled={saving || cuts.length >= 20} onClick={() => setCuts((current) => [...current, cutDraft()])}><Plus size={16} />Add another cut</Button>
        </div>
        {error ? <p className="m-0 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3"><Button type="button" variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button><Button type="button" disabled={saving} onClick={() => void apply()}>{saving ? <Loader2 className="animate-spin" size={16} /> : <Scissors size={16} />}Apply cuts & replace video</Button></div>
      </div>
    </StudioDialog>
  );
}
