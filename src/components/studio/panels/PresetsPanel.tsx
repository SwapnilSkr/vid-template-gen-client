import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import {
  listArtStyles,
  listGameplay,
  listImageModels,
  listStylePresets,
  listTtsVoices,
  updateCaptions,
  updateReelSettings,
  type ArtStyleOption,
  type GameplayClip,
  type ImageModelOption,
  type Reel,
  type StylePreset,
  type TtsVoiceOption,
} from "@/api/reels";
import { listHorrorReferences, type HorrorReference } from "@/api/trends";
import { VOICE_POST_PROFILES } from "@/components/studio/constants";
import type { ConfirmAction, StudioRun } from "@/components/studio/types";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelTitle } from "@/components/ui/panel";
import { MOTION_MODES } from "@/constants/reels";
import { cn } from "@/lib/utils";

export function PresetsPanel({
  reel,
  busy,
  run,
  requestConfirm,
}: {
  reel: Reel;
  busy: boolean;
  run: StudioRun;
  requestConfirm: (action: ConfirmAction) => void;
}) {
  const [artStyles, setArtStyles] = useState<ArtStyleOption[]>([]);
  const [imageModels, setImageModels] = useState<ImageModelOption[]>([]);
  const [voices, setVoices] = useState<TtsVoiceOption[]>([]);
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const reelKey = reel._id ?? reel.id ?? "";

  useEffect(() => {
    void listArtStyles("horror")
      .then(setArtStyles)
      .catch(() => undefined);
    void listImageModels()
      .then(setImageModels)
      .catch(() => undefined);
    void listTtsVoices()
      .then(setVoices)
      .catch(() => undefined);
    void listStylePresets(reel.niche)
      .then(setPresets)
      .catch(() => setPresets([]));
  }, [reel.niche]);

  const currentVoice =
    reel.voiceOverride?.voice ?? reel.narrationVoice?.voice ?? "";

  const applyPreset = (preset: StylePreset) =>
    requestConfirm({
      title: `Apply "${preset.displayName}" preset?`,
      body: `${preset.description} This sets art style, motion, voice, voice FX, and caption look in one go.`,
      details: [
        "Existing scene stills and narration are cleared so the new look/voice can generate.",
        "No OpenRouter call happens immediately — the next produce run regenerates them.",
        "Caption style is applied to the next render.",
      ],
      confirmLabel: "Apply preset",
      onConfirm: () =>
        run(async () => {
          await updateReelSettings(reelKey, {
            artStyleId: preset.artStyleId,
            motionMode: preset.motionMode,
            voice: preset.voice,
            audioPost: preset.audioPost,
          });
          return updateCaptions(reelKey, preset.captionStyle);
        }),
    });

  return (
    <div className="grid gap-2.5">
      <PanelTitle className="text-foreground">Look & Voice</PanelTitle>

      {presets.length ? (
        <div className="grid gap-2 rounded-md border border-border bg-card p-2.5">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
            <Sparkles size={14} className="text-primary" /> Style presets
          </span>
          <div className="grid gap-1.5">
            {presets.map((preset) => {
              const active = reel.presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={busy}
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    "grid gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors",
                    active
                      ? "border-primary/60 bg-primary/10"
                      : "border-border bg-background hover:border-input hover:bg-accent",
                  )}
                >
                  <span className="text-xs font-medium text-foreground">
                    {preset.displayName}
                    {active ? <span className="ml-2 text-[10px] font-semibold uppercase text-primary">current</span> : null}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground/80">{preset.description}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground/80">
            One-click bundle of art, motion, voice, voice FX, and caption look.
          </p>
        </div>
      ) : null}

      <Label className="text-xs text-muted-foreground">
        Art style
        <Select
          disabled={busy}
          value={reel.artStyleId ?? ""}
          onChange={(e) => {
            const artStyleId = e.target.value;
            requestConfirm({
              title: "Change art style?",
              body: "This clears existing scene stills because the current images no longer match the selected style.",
              details: [
                "No OpenRouter call happens immediately.",
                "The next asset produce run regenerates scene images.",
                "Narration audio is kept.",
              ],
              confirmLabel: "Change style",
              onConfirm: () =>
                run(() => updateReelSettings(reelKey, { artStyleId })),
            });
          }}
        >
          <option value="">Auto</option>
          {artStyles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.displayName}
            </option>
          ))}
        </Select>
      </Label>

      <Label className="text-xs text-muted-foreground">
        Motion
        <Select
          disabled={busy}
          value={reel.motionMode ?? "ken_burns"}
          onChange={(e) =>
            void run(() =>
              updateReelSettings(reelKey, {
                motionMode: e.target.value as Reel["motionMode"],
              }),
            )
          }
        >
          {MOTION_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </Label>

      <Label className="text-xs text-muted-foreground">
        Image model
        <Select
          disabled={busy}
          value={reel.imageModelOverride ?? ""}
          onChange={(e) => {
            const imageModel = e.target.value;
            requestConfirm({
              title: "Change image model?",
              body: "This clears existing scene stills so future image generation uses the selected model.",
              details: [
                "No OpenRouter call happens immediately.",
                "The next asset produce run regenerates scene images.",
                "Narration audio is kept.",
              ],
              confirmLabel: "Change model",
              onConfirm: () =>
                run(() => updateReelSettings(reelKey, { imageModel })),
            });
          }}
        >
          <option value="">Niche default</option>
          {imageModels.map((m) => (
            <option key={m.model} value={m.model}>
              {m.label}
            </option>
          ))}
        </Select>
      </Label>

      <Label className="text-xs text-muted-foreground">
        Narration voice
        <Select
          disabled={busy}
          value={currentVoice}
          onChange={(e) => {
            const v = voices.find((o) => o.voice === e.target.value);
            if (!v) return;
            requestConfirm({
              title: "Change narration voice?",
              body: "This clears existing scene narration audio so the selected voice can be generated.",
              details: [
                "No OpenRouter call happens immediately.",
                "The next asset produce run regenerates narration audio.",
                "Scene images are kept.",
              ],
              confirmLabel: "Change voice",
              onConfirm: () =>
                run(() =>
                  updateReelSettings(reelKey, {
                    voice: { model: v.model, voice: v.voice, format: v.format },
                  }),
                ),
            });
          }}
        >
          <option value="">Default</option>
          {voices.map((v) => (
            <option key={`${v.model}/${v.voice}`} value={v.voice}>
              {v.label}
            </option>
          ))}
        </Select>
      </Label>

      <Label className="text-xs text-muted-foreground">
        Voice post-processing
        <Select
          disabled={busy}
          value={reel.audioPost?.voiceProfile ?? "horror"}
          onChange={(e) => {
            const voiceProfile = e.target.value as NonNullable<
              Reel["audioPost"]
            >["voiceProfile"];
            requestConfirm({
              title: "Change voice post-processing?",
              body: "Voice FX are baked into the scene narration MP3s, so existing narration audio must be regenerated.",
              details: [
                "No OpenRouter call happens immediately.",
                "The next asset produce run regenerates narration audio with the selected treatment.",
                "Scene images are kept.",
              ],
              confirmLabel: "Change voice FX",
              onConfirm: () =>
                run(() =>
                  updateReelSettings(reelKey, {
                    audioPost: {
                      ...reel.audioPost,
                      voiceProfile,
                    },
                  }),
                ),
            });
          }}
        >
          {VOICE_POST_PROFILES.map((profile) => (
            <option key={profile.value} value={profile.value}>
              {profile.label}
            </option>
          ))}
        </Select>
      </Label>
      <p className="text-[11px] text-muted-foreground/80">
        Changing art/image model clears stills; changing voice or voice FX
        clears narration. Re-render below to apply.
      </p>
    </div>
  );
}

