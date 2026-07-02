import { CheckCircle2, Loader2, Mic, Play, Plus, X } from "lucide-react";
import { useState } from "react";
import type { Reel, RevoiceVariantInput, TtsVoiceOption } from "@/api/reels";
import { Button } from "@/components/ui/button";
import { PanelTitle, panelClassName } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { useReelStudio } from "@/store/reel-studio";
import { VoicePickerList } from "./VoicePickerList";

interface VoiceVariantsPanelProps {
  reel?: Reel;
}

/** Compare re-narrated voice takes (different OpenRouter TTS model/voice, same
 * story + gameplay clip) and promote the best one to the reel's output. */
export function VoiceVariantsPanel({ reel }: VoiceVariantsPanelProps) {
  const revoice = useReelStudio((state) => state.revoice);
  const promoteVariant = useReelStudio((state) => state.promoteVariant);
  const revoicing = useReelStudio((state) => state.revoicing);
  const loading = useReelStudio((state) => state.loading);

  const [queued, setQueued] = useState<RevoiceVariantInput[]>([]);

  const eligible = reel?.status === "completed" && reel.strategy === "gameplay_overlay";
  if (!eligible) return null;

  const variants = reel?.voiceVariants ?? [];

  function isQueued(option: TtsVoiceOption) {
    return queued.some((q) => q.model === option.model && q.voice === option.voice);
  }

  function toggleQueued(option: TtsVoiceOption) {
    setQueued((current) => {
      if (current.some((q) => q.model === option.model && q.voice === option.voice)) {
        return current.filter((q) => !(q.model === option.model && q.voice === option.voice));
      }
      if (current.length >= 5) return current;
      return [...current, { model: option.model, voice: option.voice, format: option.format, label: option.label }];
    });
  }

  return (
    <div className={cn(panelClassName, "grid gap-3 p-4")}>
      <div className="flex items-center justify-between gap-3">
        <PanelTitle>
          <span className="inline-flex items-center gap-1.5">
            <Mic size={15} /> Voice Variants
          </span>
        </PanelTitle>
        <span className="text-xs text-muted-foreground">Re-narrate with a different model/voice</span>
      </div>

      {variants.length ? (
        <div className="grid gap-2">
          {variants.map((variant) => (
            <div
              key={variant.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-bold text-foreground">
                  {variant.label || `${variant.model.split("/").pop()} / ${variant.voice}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  {variant.status === "pending" && "Rendering…"}
                  {variant.status === "ready" && (reel?.outputUrl === variant.videoUrl ? "Active" : "Ready")}
                  {variant.status === "failed" && (variant.error || "Failed")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {variant.status === "pending" ? <Loader2 className="animate-spin" size={16} /> : null}
                {variant.status === "ready" && variant.videoUrl ? (
                  <a
                    href={variant.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="grid size-8 place-items-center rounded-md border border-border text-foreground hover:bg-accent"
                    aria-label="Preview voice variant"
                  >
                    <Play size={14} />
                  </a>
                ) : null}
                {variant.status === "ready" && reel?.outputUrl !== variant.videoUrl ? (
                  <Button
                    type="button"
                    variant="default"
                    size="icon"
                    disabled={loading}
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
        <p className="m-0 text-xs leading-relaxed text-muted-foreground">
          No voice variants yet. Preview and pick up to 5 voices below, generate, then promote the take you
          like best — the gameplay clip and story stay the same, only the narration changes.
        </p>
      )}

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
                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-foreground"
              >
                {q.label}
                <button
                  type="button"
                  onClick={() => setQueued((current) => current.filter((c) => !(c.model === q.model && c.voice === q.voice)))}
                  aria-label={`Remove ${q.label}`}
                  className="cursor-pointer text-muted-foreground hover:text-foreground"
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
          disabled={!queued.length || revoicing}
          onClick={async () => {
            await revoice(queued);
            setQueued([]);
          }}
        >
          {revoicing ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
          Generate {queued.length || ""} Variant{queued.length === 1 ? "" : "s"}
        </Button>
      </div>
    </div>
  );
}
