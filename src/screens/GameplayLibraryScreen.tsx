import { Link } from "@tanstack/react-router";
import { Check, Gauge, Gamepad2, Pencil, Plus, Scissors, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteGameplay,
  listGameplay,
  renameGameplay,
  speedGameplay,
  trimGameplay,
  type GameplayClip,
} from "@/api/reels";
import { Button, buttonClassName } from "@/components/ui/button";
import { ConfirmDialog, type ConfirmDialogAction } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Panel, panelClassName } from "@/components/ui/panel";

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function formatBytes(bytes?: number): string {
  if (!bytes) return "Size unavailable";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

function clipName(filename: string): string {
  return filename.replace(/\.(mp4|mov|webm)$/i, "");
}

function GameplayClipCard({
  clip,
  editing,
  trimming,
  speeding,
  locked,
  name,
  saving,
  trimStart,
  trimEnd,
  speedValue,
  onNameChange,
  onSaveRename,
  onCancelRename,
  onBeginRename,
  onBeginTrim,
  onBeginSpeed,
  onCancelTrim,
  onCancelSpeed,
  onTrimStartChange,
  onTrimEndChange,
  onSpeedValueChange,
  onSaveTrim,
  onRequestBakeSpeed,
  onRequestDelete,
}: {
  clip: GameplayClip;
  editing: boolean;
  trimming: boolean;
  speeding: boolean;
  locked: boolean;
  name: string;
  saving: boolean;
  trimStart: string;
  trimEnd: string;
  speedValue: number;
  onNameChange: (value: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onBeginRename: () => void;
  onBeginTrim: () => void;
  onBeginSpeed: () => void;
  onCancelTrim: () => void;
  onCancelSpeed: () => void;
  onTrimStartChange: (value: string) => void;
  onTrimEndChange: (value: string) => void;
  onSpeedValueChange: (value: number) => void;
  onSaveTrim: () => void;
  onRequestBakeSpeed: () => void;
  onRequestDelete: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Live preview only — HTML playbackRate, no encode / S3 writes.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const rate = speeding ? speedValue : 1;
    video.playbackRate = rate;
    if (speeding) {
      void video.play().catch(() => {
        /* autoplay may be blocked until the user hits play once */
      });
    }
  }, [speeding, speedValue]);

  useEffect(() => {
    if (speeding) return;
    const video = videoRef.current;
    if (video) video.playbackRate = 1;
  }, [speeding]);

  return (
    <article className={panelClassName}>
      <div className="relative">
        <video
          ref={videoRef}
          src={clip.url}
          className="aspect-[9/16] w-full rounded-t-md bg-black object-cover"
          muted
          playsInline
          loop
          preload="metadata"
          controls
        />
        {speeding ? (
          <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[11px] font-medium text-white">
            Preview {speedValue}x · not saved yet
          </span>
        ) : null}
      </div>
      <div className="space-y-3 p-3">
        {editing ? (
          <div className="flex gap-2">
            <Input value={name} onChange={(event) => onNameChange(event.target.value)} autoFocus aria-label="Gameplay clip name" />
            <Button size="icon" disabled={saving || !name.trim()} onClick={onSaveRename} aria-label="Save name"><Check size={16} /></Button>
            <Button size="icon" variant="ghost" disabled={saving} onClick={onCancelRename} aria-label="Cancel rename"><X size={16} /></Button>
          </div>
        ) : (
          <div>
            <h2 className="truncate text-sm font-medium text-foreground">{clip.filename}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatBytes(clip.sizeBytes)}
              {clip.lastModified ? ` · ${new Date(clip.lastModified).toLocaleDateString()}` : ""}
            </p>
          </div>
        )}
        <p className="truncate text-xs text-muted-foreground" title={clip.key}>{clip.key}</p>
        {locked ? (
          <p className="text-xs text-amber-500">
            Used by {clip.reelReferenceCount} reel{clip.reelReferenceCount === 1 ? "" : "s"}. Rename is locked; deletion requires confirmation.
          </p>
        ) : null}
        {trimming ? (
          <div className="grid gap-2 rounded-md border border-border p-2">
            <p className="m-0 text-xs text-muted-foreground">
              Trim this reusable background. Reels using it will switch to the trimmed replacement; finished videos stay untouched.
            </p>
            <label className="grid gap-1 text-xs">
              Keep from (seconds)
              <Input type="number" min="0" step="0.1" value={trimStart} onChange={(event) => onTrimStartChange(event.target.value)} />
            </label>
            <label className="grid gap-1 text-xs">
              Keep to (seconds)
              <Input type="number" min="0" step="0.1" value={trimEnd} onChange={(event) => onTrimEndChange(event.target.value)} />
            </label>
            <div className="flex gap-2">
              <Button size="sm" disabled={saving} onClick={onSaveTrim}><Check size={14} />Save trimmed clip</Button>
              <Button size="sm" variant="ghost" disabled={saving} onClick={onCancelTrim}><X size={14} />Cancel</Button>
            </div>
          </div>
        ) : null}
        {speeding ? (
          <div className="grid gap-2 rounded-md border border-border p-2">
            <p className="m-0 text-xs text-muted-foreground">
              Preview plays in the browser at the rate below. Nothing is re-encoded or deleted until you confirm bake.
            </p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Gameplay speed preview">
              {SPEED_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={speedValue === option}
                  disabled={saving}
                  onClick={() => onSpeedValueChange(option)}
                  className={`rounded border px-2 py-1 text-xs font-medium transition-colors ${
                    speedValue === option
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {option}x
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={saving || speedValue === 1} onClick={onRequestBakeSpeed}>
                <Check size={14} />
                Bake {speedValue}x & replace
              </Button>
              <Button size="sm" variant="ghost" disabled={saving} onClick={onCancelSpeed}>
                <X size={14} />
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {!locked ? (
            <Button variant="secondary" size="sm" onClick={onBeginRename}>
              <Pencil size={14} />
              Rename
            </Button>
          ) : null}
          {!editing && !trimming && !speeding ? (
            <>
              <Button variant="secondary" size="sm" onClick={onBeginTrim}>
                <Scissors size={14} />
                Trim
              </Button>
              <Button variant="secondary" size="sm" onClick={onBeginSpeed}>
                <Gauge size={14} />
                Speed
              </Button>
            </>
          ) : null}
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onRequestDelete}>
            <Trash2 size={14} />
            Delete
          </Button>
        </div>
      </div>
    </article>
  );
}

export function GameplayLibraryScreen() {
  const [clips, setClips] = useState<GameplayClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [editingKey, setEditingKey] = useState<string>();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [trimmingKey, setTrimmingKey] = useState<string>();
  const [speedKey, setSpeedKey] = useState<string>();
  const [speedValue, setSpeedValue] = useState<number>(1);
  const [trimStart, setTrimStart] = useState("0");
  const [trimEnd, setTrimEnd] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmDialogAction>();

  const refresh = useCallback(async () => {
    try {
      setError(undefined);
      setClips(await listGameplay());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the gameplay library");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const beginRename = useCallback((clip: GameplayClip) => {
    setEditingKey(clip.key);
    setName(clipName(clip.filename));
    setTrimmingKey(undefined);
    setSpeedKey(undefined);
  }, []);

  const saveRename = useCallback(async (clip: GameplayClip) => {
    setSaving(true);
    try {
      const renamed = await renameGameplay(clip.key, name);
      setClips((previous) => previous.map((item) => (item.key === clip.key ? renamed : item)));
      setEditingKey(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename gameplay clip");
    } finally {
      setSaving(false);
    }
  }, [name]);

  const requestDelete = useCallback((clip: GameplayClip) => {
    const locked = clip.reelReferenceCount > 0;
    setConfirmAction({
      title: "Delete gameplay clip?",
      body: locked
        ? `This clip is used by ${clip.reelReferenceCount} reel${clip.reelReferenceCount === 1 ? "" : "s"}. Deleting it removes the S3 clip and marks those reels as needing a new gameplay background before they can rerender.`
        : `Remove ${clip.filename} from S3 and this computer's gameplay cache. This cannot be undone.`,
      confirmLabel: "Delete clip",
      variant: "destructive",
      details: locked
        ? [
            "Existing completed videos remain available.",
            "The affected Studio reels will show a replacement-required warning.",
            "Choose a new gameplay background before rerendering any affected reel.",
          ]
        : undefined,
      onConfirm: async () => {
        setDeleting(true);
        try {
          await deleteGameplay(clip.key, locked);
          setClips((previous) => previous.filter((item) => item.key !== clip.key));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not delete gameplay clip");
        } finally {
          setDeleting(false);
        }
      },
    });
  }, []);

  const beginTrim = useCallback((clip: GameplayClip) => {
    setTrimmingKey(clip.key);
    setSpeedKey(undefined);
    setEditingKey(undefined);
    setTrimStart("0");
    setTrimEnd("");
  }, []);

  const beginSpeed = useCallback((clip: GameplayClip) => {
    setSpeedKey(clip.key);
    setTrimmingKey(undefined);
    setEditingKey(undefined);
    setSpeedValue(1);
  }, []);

  const saveTrim = useCallback(async (clip: GameplayClip) => {
    const startSec = Number(trimStart);
    const endSec = Number(trimEnd);
    if (!Number.isFinite(startSec) || startSec < 0 || !Number.isFinite(endSec) || endSec <= startSec) {
      setError("Gameplay out must be later than gameplay in.");
      return;
    }
    setSaving(true);
    try {
      const trimmed = await trimGameplay(clip.key, startSec, endSec);
      setClips((previous) => previous.map((item) => (item.key === clip.key ? trimmed : item)));
      setTrimmingKey(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not trim gameplay clip");
    } finally {
      setSaving(false);
    }
  }, [trimEnd, trimStart]);

  const requestBakeSpeed = useCallback((clip: GameplayClip) => {
    if (speedValue === 1) return;
    setConfirmAction({
      title: `Bake ${speedValue}x gameplay?`,
      body: `Re-encode this clip at ${speedValue}x, point every reel that uses it at the new file, then delete the current S3 object.`,
      confirmLabel: `Bake ${speedValue}x & replace`,
      details: [
        "Preview above is browser-only — it has not changed the stored asset yet.",
        "Finished reel videos stay as they are; only future renders use the new pace.",
        "The previous gameplay file is removed after the replacement uploads.",
      ],
      onConfirm: async () => {
        setSaving(true);
        try {
          const sped = await speedGameplay(clip.key, speedValue);
          setClips((previous) => previous.map((item) => (item.key === clip.key ? sped : item)));
          setSpeedKey(undefined);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not change gameplay speed");
        } finally {
          setSaving(false);
        }
      },
    });
  }, [speedValue]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Gameplay library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preview speed in the player first, then bake to replace the S3 clip. Trim works the same replace-and-clear way.
          </p>
        </div>
        <Link to="/youtube" className={buttonClassName("default")}>
          <Plus size={16} />
          Import from YouTube
        </Link>
      </header>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? <div className="py-12 text-center text-sm text-muted-foreground">Loading gameplay clips…</div> : null}
      {!loading && clips.length === 0 ? (
        <Panel>
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <Gamepad2 className="text-muted-foreground" size={28} />
            <p className="text-sm text-muted-foreground">
              No gameplay clips yet. Search YouTube, then choose <strong>Add as gameplay</strong>.
            </p>
            <Link to="/youtube" className={buttonClassName("secondary")}>
              Open YouTube import
            </Link>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {clips.map((clip) => (
          <GameplayClipCard
            key={clip.key}
            clip={clip}
            editing={editingKey === clip.key}
            trimming={trimmingKey === clip.key}
            speeding={speedKey === clip.key}
            locked={clip.reelReferenceCount > 0}
            name={name}
            saving={saving}
            trimStart={trimStart}
            trimEnd={trimEnd}
            speedValue={speedValue}
            onNameChange={setName}
            onSaveRename={() => void saveRename(clip)}
            onCancelRename={() => setEditingKey(undefined)}
            onBeginRename={() => beginRename(clip)}
            onBeginTrim={() => beginTrim(clip)}
            onBeginSpeed={() => beginSpeed(clip)}
            onCancelTrim={() => setTrimmingKey(undefined)}
            onCancelSpeed={() => setSpeedKey(undefined)}
            onTrimStartChange={setTrimStart}
            onTrimEndChange={setTrimEnd}
            onSpeedValueChange={setSpeedValue}
            onSaveTrim={() => void saveTrim(clip)}
            onRequestBakeSpeed={() => requestBakeSpeed(clip)}
            onRequestDelete={() => requestDelete(clip)}
          />
        ))}
      </div>
      <ConfirmDialog action={confirmAction} busy={saving || deleting} onClose={() => setConfirmAction(undefined)} />
    </div>
  );
}
