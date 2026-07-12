import { Clapperboard, Youtube } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { updateReelSettings, type Reel } from "@/api/reels";
import type { ConfirmAction, StudioRun } from "@/components/studio/types";
import { cn } from "@/lib/utils";

export function hasPartTeaser(reel: Reel): boolean {
  const partNumber = reel.partNumber ?? reel.redditStory?.partNumber ?? 1;
  const partCount = reel.partCount ?? reel.redditStory?.partCount ?? 1;
  return reel.strategy === "gameplay_overlay" && partNumber < partCount;
}

export function nextPartNumber(reel: Reel): number {
  return (reel.partNumber ?? reel.redditStory?.partNumber ?? 1) + 1;
}

/** Include/skip toggles for part teaser + branded outro. Free at plan review;
 *  after produce, skipping confirms S3 cache cleanup. */
export function OutroIncludeToggles({
  reel,
  busy,
  run,
  requestConfirm,
  compact,
}: {
  reel: Reel;
  busy: boolean;
  run: StudioRun;
  requestConfirm: (action: ConfirmAction) => void;
  /** Tighter layout for the plan-review gate banner. */
  compact?: boolean;
}) {
  const reelKey = reel._id ?? reel.id ?? "";
  const isPlanReview = reel.status === "plan_review";
  const showPartTeaser = hasPartTeaser(reel);
  const [skipPartOutro, setSkipPartOutro] = useState(Boolean(reel.skipPartOutro));
  const [skipBrandedOutro, setSkipBrandedOutro] = useState(Boolean(reel.skipBrandedOutro));

  useEffect(() => {
    setSkipPartOutro(Boolean(reel.skipPartOutro));
    setSkipBrandedOutro(Boolean(reel.skipBrandedOutro));
  }, [reel.skipPartOutro, reel.skipBrandedOutro]);

  async function persist(next: {
    skipPartOutro?: boolean;
    skipBrandedOutro?: boolean;
  }) {
    await run(() => updateReelSettings(reelKey, next));
  }

  function togglePartOutro(include: boolean) {
    const nextSkip = !include;
    if (nextSkip === skipPartOutro) return;
    setSkipPartOutro(nextSkip);
    if (isPlanReview || !nextSkip) {
      void persist({ skipPartOutro: nextSkip });
      return;
    }
    requestConfirm({
      title: "Skip part teaser?",
      body: "Removes the “Stay tuned for part N” line and card from the next render.",
      details: [
        "Cached part-outro audio is deleted from S3.",
        "Body video cache is cleared — a normal re-render rebuilds the story without the teaser.",
      ],
      confirmLabel: "Skip part teaser",
      costTone: "warm",
      onConfirm: () => void persist({ skipPartOutro: true }),
      onCancel: () => setSkipPartOutro(false),
    });
  }

  function toggleBrandedOutro(include: boolean) {
    const nextSkip = !include;
    if (nextSkip === skipBrandedOutro) return;
    setSkipBrandedOutro(nextSkip);
    if (isPlanReview || !nextSkip) {
      void persist({ skipBrandedOutro: nextSkip });
      return;
    }
    requestConfirm({
      title: "Skip branded outro?",
      body: "Removes the channel end card and subscribe narration from the next render.",
      details: [
        "Cached branded-outro audio is deleted from S3.",
        "Body video is kept (it never included this outro) — outro-only re-render can republish the body as final.",
      ],
      confirmLabel: "Skip branded outro",
      costTone: "warm",
      onConfirm: () => void persist({ skipBrandedOutro: true }),
      onCancel: () => setSkipBrandedOutro(false),
    });
  }

  return (
    <div className={cn("grid gap-2", compact ? "sm:grid-cols-2" : undefined)}>
      {showPartTeaser ? (
        <OutroToggle
          icon={<Clapperboard size={14} className="text-muted-foreground" />}
          label="Part teaser"
          hint={`“Stay tuned for part ${nextPartNumber(reel)}.”`}
          checked={!skipPartOutro}
          disabled={busy}
          compact={compact}
          onChange={togglePartOutro}
        />
      ) : null}
      <OutroToggle
        icon={<Youtube size={14} className="text-muted-foreground" />}
        label="Branded outro"
        hint="Channel card + subscribe TTS after the body."
        checked={!skipBrandedOutro}
        disabled={busy}
        compact={compact}
        onChange={toggleBrandedOutro}
      />
    </div>
  );
}

function OutroToggle({
  icon,
  label,
  hint,
  checked,
  disabled,
  compact,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  compact?: boolean;
  onChange: (include: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-2 rounded-md border border-border bg-background/60 text-xs text-foreground",
        compact ? "px-2 py-1.5" : "px-2.5 py-2",
        disabled && "opacity-60"
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="grid gap-0.5">
        <span className="inline-flex items-center gap-1.5 font-medium">
          {icon}
          Include {label}
        </span>
        <span className="text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}
