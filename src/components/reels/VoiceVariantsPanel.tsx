import { CheckCircle2, Loader2, Mic, Play, Plus, X } from "lucide-react";
import { useState } from "react";
import {
  promoteVoiceVariant,
  revoiceReel,
  type Reel,
  type RevoiceVariantInput,
  type TtsVoiceOption,
} from "@/api/reels";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VoicePickerList } from "./VoicePickerList";

interface VoiceVariantsPanelProps {
  reel: Reel;
  reelId: string;
  onRefresh: () => void | Promise<void>;
}

/** Compare re-narrated voice takes (different OpenRouter TTS model/voice, same
 * story + gameplay clip) and promote the best one to the reel's output. */
export function VoiceVariantsPanel({
  reel,
  reelId,
  onRefresh,
}: VoiceVariantsPanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [queued, setQueued] = useState<RevoiceVariantInput[]>([]);

  const eligible =
    reel.status === "completed" && reel.strategy === "gameplay_overlay";
  if (!eligible) return null;

  const variants = reel.voiceVariants ?? [];

  async function generateQueuedVariants() {
    setError(undefined);
    setBusy(true);
    try {
      await revoiceReel(reelId, queued);
      await onRefresh();
      setQueued([]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to queue voice variants",
      );
    } finally {
      setBusy(false);
    }
  }

  async function promoteVariant(variantId: string) {
    setError(undefined);
    setBusy(true);
    try {
      await promoteVoiceVariant(reelId, variantId);
      await onRefresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to promote voice variant",
      );
    } finally {
      setBusy(false);
    }
  }

  function isQueued(option: TtsVoiceOption) {
    return queued.some(
      (q) => q.model === option.model && q.voice === option.voice,
    );
  }

  function toggleQueued(option: TtsVoiceOption) {
    setQueued((current) => {
      if (
        current.some(
          (q) => q.model === option.model && q.voice === option.voice,
        )
      ) {
        return current.filter(
          (q) => !(q.model === option.model && q.voice === option.voice),
        );
      }
      if (current.length >= 5) return current;
      return [
        ...current,
        {
          model: option.model,
          voice: option.voice,
          format: option.format,
          label: option.label,
        },
      ];
    });
  }

  return (
    <section
      className={cn("grid gap-3 rounded-lg border border-border bg-card p-4")}
    >
      <div className="flex items-center justify-between gap-3">
        <strong className="section-label inline-flex items-center gap-2">
          <Mic size={15} className="text-muted-foreground/70" /> Voice Variants
        </strong>
        <span className="text-xs text-muted-foreground/80">
          Whole-reel alternate takes
        </span>
      </div>

      <p className="m-0 text-xs leading-relaxed text-muted-foreground/80">
        Re-narrate the full video with up to five voices, compare previews, then
        promote the take you want. Per-scene audio changes use the Audio button
        on each scene card.
      </p>

      {variants.length ? (
        <div className="grid gap-2">
          {variants.map((variant) => (
            <div
              key={variant.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/60 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-foreground">
                  {variant.label ||
                    `${variant.model.split("/").pop()} / ${variant.voice}`}
                </div>
                <div className="text-xs text-muted-foreground/80">
                  {variant.status === "pending" && "Rendering…"}
                  {variant.status === "ready" &&
                    (reel.outputUrl === variant.videoUrl ? "Active" : "Ready")}
                  {variant.status === "failed" && (variant.error || "Failed")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {variant.status === "pending" ? (
                  <Loader2 className="animate-spin text-muted-foreground" size={16} />
                ) : null}
                {variant.status === "ready" && variant.videoUrl ? (
                  <a
                    href={variant.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="grid size-8 place-items-center rounded-md border border-border bg-secondary text-foreground hover:bg-accent"
                    aria-label="Preview voice variant"
                  >
                    <Play size={14} />
                  </a>
                ) : null}
                {variant.status === "ready" &&
                reel.outputUrl !== variant.videoUrl ? (
                  <Button
                    type="button"
                    variant="default"
                    size="icon"
                    disabled={busy}
                    onClick={() => void promoteVariant(variant.id)}
                    aria-label="Use this voice"
                  >
                    <CheckCircle2 size={14} />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="m-0 text-xs leading-relaxed text-muted-foreground/80">
          No voice variants yet. Preview and pick up to 5 voices below,
          generate, then promote the take you like best — the gameplay clip and
          story stay the same, only the narration changes.
        </p>
      )}

      {error ? (
        <p className="m-0 text-xs font-semibold text-destructive">{error}</p>
      ) : null}

      <div className="grid gap-2">
        <VoicePickerList
          isSelected={isQueued}
          onToggle={toggleQueued}
          isDisabled={() => queued.length >= 5}
          selectedLabel="Added"
          unselectedLabel="Add"
        />

        {queued.length ? (
          <div className="flex flex-wrap gap-1.5">
            {queued.map((q) => (
              <span
                key={`${q.model}-${q.voice}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground"
              >
                {q.label}
                <button
                  type="button"
                  onClick={() =>
                    setQueued((current) =>
                      current.filter(
                        (c) => !(c.model === q.model && c.voice === q.voice),
                      ),
                    )
                  }
                  aria-label={`Remove ${q.label}`}
                  className="cursor-pointer text-muted-foreground/80 hover:text-foreground"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <Button
          type="button"
          variant="default"
          disabled={!queued.length || busy}
          onClick={() => void generateQueuedVariants()}
        >
          {busy ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Plus size={16} />
          )}
          Generate {queued.length || ""} Variant{queued.length === 1 ? "" : "s"}
        </Button>
      </div>
    </section>
  );
}
