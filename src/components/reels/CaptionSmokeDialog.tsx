import { useEffect, useState } from "react";
import { FlaskConical, Loader2, X } from "lucide-react";
import {
  runCaptionSmokeTest,
  type CaptionSmokeResult,
} from "@/api/reels";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Modal that hits GET /api/maintenance/caption-smoke (same as `bun run smoke:captions`). */
export function CaptionSmokeDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [runId, setRunId] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CaptionSmokeResult | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setBusy(true);
    setResult(undefined);
    setError(undefined);

    void runCaptionSmokeTest()
      .then((next) => {
        if (!cancelled) setResult(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, runId]);

  useEffect(() => {
    if (!open) {
      setResult(undefined);
      setError(undefined);
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60 grid place-items-center bg-black/50 px-4">
      <div className="grid w-full max-w-lg gap-3 rounded-lg border border-border bg-card p-4 shadow-pop">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <strong className="text-base text-foreground">Caption smoke test</strong>
            <p className="m-0 text-sm leading-relaxed text-muted-foreground">
              Burns ASS captions onto a temp clip on the API host (no MongoDB / no reel
              assets). Verifies FFmpeg, libass, fonts, and the one-space path fix.
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={busy}
            onClick={onClose}
            className="text-muted-foreground hover:bg-accent"
          >
            <X size={16} />
          </Button>
        </div>

        {busy ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5 text-sm text-muted-foreground">
            <Loader2 className="animate-spin" size={15} />
            Running smoke test on the server…
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="grid gap-2">
            <div
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-medium",
                result.success
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              )}
            >
              {result.message}
            </div>
            <ul className="m-0 grid max-h-64 list-none gap-1.5 overflow-y-auto rounded-md border border-border bg-background p-2.5">
              {result.checks.map((check) => (
                <li
                  key={check.id}
                  className="grid grid-cols-[auto_1fr] gap-2 text-xs leading-relaxed text-muted-foreground"
                >
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      check.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                    )}
                  >
                    {check.ok ? "✓" : "✗"}
                  </span>
                  <span>
                    <span className="font-medium text-foreground">[{check.id}]</span>{" "}
                    {check.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setRunId((n) => n + 1)}
          >
            {busy ? <Loader2 className="animate-spin" size={14} /> : <FlaskConical size={14} />}
            Run again
          </Button>
          <Button type="button" variant="default" disabled={busy} onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Always-available trigger — opens {@link CaptionSmokeDialog}. */
export function CaptionSmokeButton({
  label = "Test captions",
  className,
  variant = "outline",
  size = "default",
}: {
  label?: string;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
        title="Run caption burn smoke test on the API host"
      >
        <FlaskConical size={15} />
        {label}
      </Button>
      <CaptionSmokeDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
