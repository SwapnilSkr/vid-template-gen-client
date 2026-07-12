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
  const [activeModel, setActiveModel] = useState<string | null>(null);
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

  useEffect(() => {
    if (grouped.length > 0 && activeModel === null) {
      setActiveModel(grouped[0][0]);
    }
  }, [grouped, activeModel]);

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
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap gap-2">
        {grouped.map(([model, voices]) => {
          const isActive = model === activeModel;
          return (
            <button
              key={model}
              type="button"
              onClick={() => setActiveModel(model)}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {voices[0]?.provider ?? modelLabel(model)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {activeModel && grouped.find(([m]) => m === activeModel)?.[1].map((option) => {
          const key = voiceKey(option.model, option.voice);
          const selected = isSelected(option);
          const disabled = !selected && (isDisabled?.(option) ?? false);
          return (
            <div
              key={key}
              onClick={() => {
                if (!disabled) onToggle(option);
              }}
              className={cn(
                "group relative flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors",
                selected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-foreground hover:border-primary/50",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              <span className="font-medium truncate">
                {selected ? `${selectedLabel}: ` : ""}
                {voiceLabel(option.label)}
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void togglePlay(option);
                }}
                aria-label={playingKey === key ? "Pause sample" : "Play sample"}
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition-opacity hover:bg-primary hover:text-primary-foreground",
                  playingKey === key || loadingKey === key
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100 focus:opacity-100"
                )}
              >
                {loadingKey === key ? (
                  <Loader2 className="animate-spin" size={10} />
                ) : playingKey === key ? (
                  <Pause size={10} />
                ) : (
                  <Play size={10} />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
