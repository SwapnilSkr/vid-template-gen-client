import { Loader2, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getVoiceSample, type TtsVoiceOption } from "@/api/reels";
import { cn } from "@/lib/utils";
import { useReelStudio } from "@/store/reel-studio";

const MODEL_LABELS: Record<string, string> = {
  "google/gemini-3.1-flash-tts-preview": "Gemini Flash TTS",
  "hexgrad/kokoro-82m": "Kokoro",
  "microsoft/mai-voice-2": "MAI Voice 2",
  "canopylabs/orpheus-3b-0.1-ft": "Orpheus-3B",
  "x-ai/grok-voice-tts-1.0": "Grok Voice",
};

function modelLabel(model: string): string {
  return MODEL_LABELS[model] ?? model.split("/").pop() ?? model;
}

/** Strips the "Name — " provider portion off a catalog label once it's grouped under a model heading. */
function voiceLabel(label: string): string {
  return label.split(" — ").slice(1).join(" — ") || label;
}

function voiceKey(model: string, voice: string): string {
  return `${model}|${voice}`;
}

interface VoicePickerListProps {
  isSelected: (option: TtsVoiceOption) => boolean;
  onToggle: (option: TtsVoiceOption) => void;
  isDisabled?: (option: TtsVoiceOption) => boolean;
  selectedLabel?: string;
  unselectedLabel?: string;
  className?: string;
}

/** Scrollable, model-grouped voice list with a per-voice sample preview
 * (play/pause) and a selection action — shared between the create-reel
 * single-pick and the revoice up-to-5-pick UIs. */
export function VoicePickerList({
  isSelected,
  onToggle,
  isDisabled,
  selectedLabel = "Selected",
  unselectedLabel = "Use",
  className,
}: VoicePickerListProps) {
  const ttsVoices = useReelStudio((state) => state.ttsVoices);
  const loadTtsVoices = useReelStudio((state) => state.loadTtsVoices);

  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    void loadTtsVoices();
  }, [loadTtsVoices]);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    const onEnded = () => setPlayingKey(null);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.pause();
    };
  }, []);

  const grouped = useMemo(() => {
    const byModel = new Map<string, TtsVoiceOption[]>();
    for (const voice of ttsVoices) {
      const list = byModel.get(voice.model) ?? [];
      list.push(voice);
      byModel.set(voice.model, list);
    }
    return [...byModel.entries()];
  }, [ttsVoices]);

  async function togglePlay(option: TtsVoiceOption) {
    const key = voiceKey(option.model, option.voice);
    const audio = audioRef.current;
    if (!audio) return;

    if (playingKey === key) {
      audio.pause();
      setPlayingKey(null);
      return;
    }

    setLoadingKey(key);
    try {
      const url = await getVoiceSample(option.model, option.voice);
      audio.src = url;
      await audio.play();
      setPlayingKey(key);
    } catch {
      // non-fatal — sample generation can fail if the provider key is missing
    } finally {
      setLoadingKey(null);
    }
  }

  return (
    <div className={cn("max-h-64 overflow-y-auto rounded-md border border-border", className)}>
      {grouped.map(([model, voices]) => (
        <div key={model}>
          <div className="sticky top-0 flex items-center justify-between gap-2 bg-muted px-2.5 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
            <span>{voices[0]?.provider ?? modelLabel(model)}</span>
            {voices[0]?.priceLabel ? <span className="normal-case">{voices[0].priceLabel}</span> : null}
          </div>
          {voices.map((option) => {
            const key = voiceKey(option.model, option.voice);
            const selected = isSelected(option);
            const disabled = !selected && (isDisabled?.(option) ?? false);
            return (
              <div
                key={key}
                className={cn(
                  "flex items-center justify-between gap-2 border-t border-border/60 px-2.5 py-1.5 text-xs",
                  selected && "bg-primary/5"
                )}
                data-selected={selected ? "true" : undefined}
              >
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate font-semibold text-foreground", selected && "text-primary")}>
                    {selected ? "Selected: " : ""}
                    {voiceLabel(option.label)}
                  </span>

                </span>
                <button
                  type="button"
                  onClick={() => void togglePlay(option)}
                  aria-label={playingKey === key ? "Pause sample" : "Play sample"}
                  className="grid size-7 shrink-0 place-items-center rounded-md border border-border text-foreground hover:bg-accent"
                >
                  {loadingKey === key ? (
                    <Loader2 className="animate-spin" size={13} />
                  ) : playingKey === key ? (
                    <Pause size={13} />
                  ) : (
                    <Play size={13} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onToggle(option)}
                  disabled={disabled}
                  className={cn(
                    "shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-40",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-foreground hover:bg-accent"
                  )}
                >
                  {selected ? selectedLabel : unselectedLabel}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
