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

interface ConfirmAction {
  title: string;
  body: string;
  details?: string[];
  confirmLabel: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
}

interface VoiceVariantsPanelProps {
  reel: Reel;
  reelId: string;
  locked?: boolean;
  onRefresh: () => void | Promise<void>;
  /** Optional: preview a ready variant in the program monitor without promoting. */
  onPreviewVariant?: (videoUrl: string | undefined) => void;
  requestConfirm?: (action: ConfirmAction) => void;
}

/** Compare re-narrated voice takes (different OpenRouter TTS model/voice, same
 * story + gameplay clip) and promote the best one to the reel's output. */
export function VoiceVariantsPanel({
  reel,
  reelId,
  locked = false,
  onRefresh,
  onPreviewVariant,
  requestConfirm,
}: VoiceVariantsPanelProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [queued, setQueued] = useState<RevoiceVariantInput[]>([]);

  const eligible =
    reel.status === "completed" && reel.strategy === "gameplay_overlay";
  if (!eligible) return null;

  const variants = reel.voiceVariants ?? [];
  const controlsDisabled = busy || locked;

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
      onPreviewVariant?.(undefined);
      await onRefresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to promote voice variant",
      );
    } finally {
      setBusy(false);
    }
  }

  function requestGenerate() {
    if (!queued.length) return;
    const action: ConfirmAction = {
      title: `Generate ${queued.length} voice variant${queued.length === 1 ? "" : "s"}?`,
      body: "Each variant re-narrates the full reel with OpenRouter TTS and renders a new preview video.",
      details: [
        `${queued.length} × full-reel TTS + gameplay composite.`,
        "OpenRouter narration credits will be charged per variant.",
        "Promote a ready take afterward to make it the studio output.",
      ],
      confirmLabel: "Spend credits & generate",
      onConfirm: () => void generateQueuedVariants(),
    };
    if (requestConfirm) requestConfirm(action);
    else void generateQueuedVariants();
  }

  function isQueued(option: TtsVoiceOption) {
    return queued.some(
      (q) => q.model === option.model && q.voice === option.voice,
    );
  }

  function toggleQueued(option: TtsVoiceOption) {
    if (controlsDisabled) return;
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



      {variants.length ? (
        <div className="grid gap-2">
          {variants.map((variant) => {
            const isActive =
              variant.status === "ready" &&
              Boolean(variant.videoUrl) &&
              reel.outputUrl === variant.videoUrl;
            return (
              <div
                key={variant.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-foreground">
                    {variant.label ||
                      `${variant.model.split("/").pop()} / ${variant.voice}`}
                  </div>
                  <div className="text-xs text-muted-foreground/80">
                    {variant.status === "pending" && "Rendering…"}
                    {variant.status === "ready" &&
                      (isActive ? "Active in studio" : "Ready — not applied yet")}
                    {variant.status === "failed" && (variant.error || "Failed")}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {variant.status === "pending" ? (
                    <Loader2 className="animate-spin text-muted-foreground" size={16} />
                  ) : null}
                  {variant.status === "ready" && variant.videoUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={controlsDisabled}
                      onClick={() => onPreviewVariant?.(variant.videoUrl)}
                      aria-label="Preview voice variant in studio"
                    >
                      <Play size={14} />
                      Preview
                    </Button>
                  ) : null}
                  {variant.status === "ready" && !isActive ? (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      disabled={controlsDisabled}
                      onClick={() => void promoteVariant(variant.id)}
                    >
                      {busy ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                      Use in studio
                    </Button>
                  ) : null}
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-success/40 bg-success/10 px-2 py-1 text-xs font-medium text-success">
                      <CheckCircle2 size={12} />
                      In studio
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (

      )}

      {error ? (
        <p className="m-0 text-xs font-semibold text-destructive">{error}</p>
      ) : null}

      <div className="grid gap-2">
        <VoicePickerList
          isSelected={isQueued}
          onToggle={toggleQueued}
          isDisabled={() => controlsDisabled || queued.length >= 5}
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
                  disabled={controlsDisabled}
                  onClick={() =>
                    setQueued((current) =>
                      current.filter(
                        (c) => !(c.model === q.model && c.voice === q.voice),
                      ),
                    )
                  }
                  aria-label={`Remove ${q.label}`}
                  className="cursor-pointer text-muted-foreground/80 hover:text-foreground disabled:opacity-50"
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
          disabled={!queued.length || controlsDisabled}
          onClick={() => requestGenerate()}
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
