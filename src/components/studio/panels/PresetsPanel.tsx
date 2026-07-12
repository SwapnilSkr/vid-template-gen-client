import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import {
  listArtStyles,
  listGameplay,
  listImageModels,
  listStylePresets,
  updateCaptions,
  updateReelSettings,
  type ArtStyleOption,
  type GameplayClip,
  type ImageModelOption,
  type Reel,
  type StylePreset,
} from "@/api/reels";
import { listHorrorReferences, type HorrorReference } from "@/api/trends";
import type { ConfirmAction, StudioRun } from "@/components/studio/types";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelTitle } from "@/components/ui/panel";
import { MOTION_MODES } from "@/constants/reels";
import { cn } from "@/lib/utils";

const ART_STYLE_FALLBACK_COLORS = [
  ["#f6d365", "#fda085"],
  ["#84fab0", "#8fd3f4"],
  ["#a18cd1", "#fbc2eb"],
  ["#ffecd2", "#fcb69f"],
  ["#cfd9df", "#e2ebf0"],
];

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
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const reelKey = reel._id ?? reel.id ?? "";

  useEffect(() => {
    void listArtStyles("horror")
      .then(setArtStyles)
      .catch(() => undefined);
    void listImageModels()
      .then(setImageModels)
      .catch(() => undefined);
    void listStylePresets(reel.niche)
      .then(setPresets)
      .catch(() => setPresets([]));
  }, [reel.niche]);

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
      <PanelTitle className="text-foreground">Look</PanelTitle>

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

      <div className="grid gap-2 pt-2">
        <span className="text-xs font-medium text-foreground">Art style</span>
        <div className="grid grid-cols-5 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (reel.artStyleId) {
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
                    run(() => updateReelSettings(reelKey, { artStyleId: "" })),
                });
              }
            }}
            className="flex flex-col gap-1.5 text-left group"
          >
            <div
              className={cn(
                "h-14 w-full rounded-md border border-border bg-secondary shadow-sm transition-all",
                !reel.artStyleId
                  ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                  : "group-hover:border-primary/50",
              )}
            />
            <span className="text-xs font-medium text-foreground">Auto</span>
          </button>
          {artStyles.map((s, i) => {
            const active = reel.artStyleId === s.id;
            const colors =
              ART_STYLE_FALLBACK_COLORS[i % ART_STYLE_FALLBACK_COLORS.length];
            return (
              <button
                key={s.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!active) {
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
                        run(() => updateReelSettings(reelKey, { artStyleId: s.id })),
                    });
                  }
                }}
                className="flex flex-col gap-1.5 text-left group"
              >
                <div
                  className={cn(
                    "h-14 w-full rounded-md border border-border shadow-sm transition-all",
                    active
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                      : "group-hover:border-primary/50",
                  )}
                  style={{
                    background: s.thumbnailUrl
                      ? `url(${s.thumbnailUrl}) center/cover`
                      : `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
                  }}
                />
                <span className="text-xs font-medium text-foreground">
                  {s.displayName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

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

      <p className="text-[11px] text-muted-foreground/80">
        Changing art or image model clears stills. Narration controls now live
        in the dedicated Voice tab.
      </p>
    </div>
  );
}
