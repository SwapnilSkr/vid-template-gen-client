import { Mic2 } from "lucide-react";
import { VoicePickerList } from "@/components/reels/VoicePickerList";
import { VOICE_POST_PROFILES } from "@/components/studio/constants";
import type { ConfirmAction, StudioRun } from "@/components/studio/types";
import { Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelTitle } from "@/components/ui/panel";
import { updateReelSettings, type Reel, type TtsVoiceOption } from "@/api/reels";

export function VoicePanel({ reel, busy, run, requestConfirm }: {
  reel: Reel;
  busy: boolean;
  run: StudioRun;
  requestConfirm: (action: ConfirmAction) => void;
}) {
  const reelKey = reel._id ?? reel.id ?? "";
  const selectedModel = reel.voiceOverride?.model ?? reel.narrationVoice?.model;
  const selectedVoice = reel.voiceOverride?.voice ?? reel.narrationVoice?.voice;
  const isPlanReview = reel.status === "plan_review";
  const isHorror = reel.niche.startsWith("horror");

  const chooseVoice = (voice: TtsVoiceOption) => {
    if (busy || (voice.model === selectedModel && voice.voice === selectedVoice)) return;
    requestConfirm({
    title: `Use ${voice.label}?`,
    body: isPlanReview
      ? "This records the voice for production. No TTS is generated until you approve the plan."
      : "This changes the narration voice and clears cached narration so it can be regenerated.",
    details: isPlanReview
      ? ["No charge now.", "The approved produce run will use this exact model and voice.", "Scene images are unaffected."]
      : ["No OpenRouter call happens immediately.", "The next produce run spends TTS credits for narration.", "Scene images are kept."],
    confirmLabel: isPlanReview ? "Select voice (free now)" : "Change voice",
    costTone: isPlanReview ? "free" : "warm",
    onConfirm: () => run(() => updateReelSettings(reelKey, {
      voice: { model: voice.model, voice: voice.voice, format: voice.format },
    })),
    });
  };

  return (
    <div className="grid gap-3">
      <PanelTitle className="inline-flex items-center gap-2 text-foreground">
        <Mic2 size={15} className="text-primary" /> Narration voice
      </PanelTitle>

      <div className="rounded-md border border-border bg-card px-2.5 py-2 text-xs text-muted-foreground">
        {isPlanReview
          ? "Plan review: listen and choose now. This only saves the setting; TTS credits are used after approval."
          : "Listen before switching. Changing an already-generated voice requires new narration audio, but keeps all images."}
      </div>

      <VoicePickerList
        className="max-h-[42vh]"
        isSelected={(option) => option.model === selectedModel && option.voice === selectedVoice}
        onToggle={chooseVoice}
        isDisabled={() => busy}
        selectedLabel="Selected"
        unselectedLabel={isPlanReview ? "Choose" : "Use"}
      />

      {isHorror ? (
        <Label className="text-xs text-muted-foreground">
          Voice post-processing
          <Select
            disabled={busy}
            value={reel.audioPost?.voiceProfile ?? "horror"}
            onChange={(event) => {
              const voiceProfile = event.target.value as NonNullable<Reel["audioPost"]>["voiceProfile"];
              requestConfirm({
                title: "Change voice treatment?",
                body: isPlanReview
                  ? "This treatment will be applied when narration is generated after approval."
                  : "Voice treatment is baked into narration audio, so cached narration must be regenerated.",
                details: isPlanReview
                  ? ["No charge now.", "Scene images are unaffected."]
                  : ["No charge occurs immediately.", "The next produce run regenerates narration only."],
                confirmLabel: isPlanReview ? "Select treatment (free now)" : "Change treatment",
                costTone: isPlanReview ? "free" : "warm",
                onConfirm: () => run(() => updateReelSettings(reelKey, {
                  audioPost: { ...reel.audioPost, voiceProfile },
                })),
              });
            }}
          >
            {VOICE_POST_PROFILES.map((profile) => <option key={profile.value} value={profile.value}>{profile.label}</option>)}
          </Select>
        </Label>
      ) : (
        <p className="m-0 text-[11px] text-muted-foreground/80">
          Reddit narration uses the selected voice cleanly; horror-specific room, tape, and whisper processing is intentionally disabled.
        </p>
      )}
    </div>
  );
}
