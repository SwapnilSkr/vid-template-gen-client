import { Film, Loader2, RefreshCw, Shuffle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { getReelDefaults, type CreateReelInput, type ImageModelOption, type ReelDefaults, type TtsVoiceOption } from "@/api/reels";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { panelClassName } from "@/components/ui/panel";
import { MOTION_MODES, NICHE_GENRES, NICHES } from "@/constants/reels";
import { cn } from "@/lib/utils";
import { useReelStudio } from "@/store/reel-studio";
import { formatLabel, parsePartsValue } from "@/utils/reel";
import { VoicePickerList } from "./VoicePickerList";

const defaultForm: CreateReelInput = {
  niche: "reddit",
  genre: "aita_family",
  topic: "auto",
  tier: "cheap",
  source: "hybrid",
  parts: "off",
  gameplayKey: "",
  imageModel: "",
};

interface CreateReelFormProps {
  /** Called after a reel is successfully created (e.g. to navigate away). */
  onCreated?: () => void;
}

function modelDisplayName(model?: string): string {
  if (!model) return "tier default";
  const friendly: Record<string, string> = {
    "anthropic/claude-sonnet-5": "Claude Sonnet 5",
    "google/gemini-2.5-flash": "Gemini 2.5 Flash",
    "deepseek/deepseek-v4-flash": "DeepSeek V4 Flash",
  };
  return friendly[model] ?? model;
}

export function CreateReelForm({ onCreated }: CreateReelFormProps = {}) {
  const create = useReelStudio((state) => state.create);
  const loading = useReelStudio((state) => state.loading);
  const load = useReelStudio((state) => state.load);
  const gameplayClips = useReelStudio((state) => state.gameplayClips);
  const horrorAudios = useReelStudio((state) => state.horrorAudios);
  const imageModels = useReelStudio((state) => state.imageModels);
  const artStyles = useReelStudio((state) => state.artStyles);
  const loadGameplay = useReelStudio((state) => state.loadGameplay);
  const loadHorrorAudio = useReelStudio((state) => state.loadHorrorAudio);
  const loadImageModels = useReelStudio((state) => state.loadImageModels);
  const loadArtStyles = useReelStudio((state) => state.loadArtStyles);
  const [form, setForm] = useState<CreateReelInput>(defaultForm);
  const [topicMode, setTopicMode] = useState<"auto" | "custom">("auto");
  const [voiceMode, setVoiceMode] = useState<"default" | "custom">("default");
  const [resolvedDefaults, setResolvedDefaults] = useState<ReelDefaults | undefined>();

  useEffect(() => {
    void loadGameplay();
    void loadHorrorAudio();
    void loadImageModels();
    void loadArtStyles();
  }, [loadGameplay, loadHorrorAudio, loadImageModels, loadArtStyles]);

  useEffect(() => {
    let cancelled = false;
    void getReelDefaults(form.niche, form.tier ?? "cheap")
      .then((defaults) => {
        if (!cancelled) setResolvedDefaults(defaults);
      })
      .catch(() => {
        if (!cancelled) setResolvedDefaults(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [form.niche, form.tier]);

  const selectedClip = gameplayClips.find((clip) => clip.key === form.gameplayKey);
  const selectedHorrorAudio = horrorAudios.find((audio) => audio.key === form.horrorAudioKey);
  const selectedImageModel = imageModels.find((option) => option.model === form.imageModel);
  const selectedVoice = useReelStudio((state) =>
    state.ttsVoices.find((option) => option.model === form.ttsModel && option.voice === form.ttsVoice)
  );
  const isGameplayNiche = form.niche === "reddit"; // only gameplay_overlay niches use a gameplay background
  const isHorrorNiche = form.niche.startsWith("horror");
  const genreOptions = NICHE_GENRES[form.niche] ?? [];
  const horrorArtStyles = artStyles.filter((style) => style.niches.includes("horror"));
  const selectedArtStyle = horrorArtStyles.find((style) => style.id === form.artStyleId);
  const refArtModelWarning = Boolean(
    form.artStyleId && selectedImageModel && selectedImageModel.supportsReferenceArt === false
  );
  const motionMode = form.motionMode ?? "parallax";

  return (
    <form
      className={cn(panelClassName, "mb-2.5 grid gap-3 p-4")}
      onSubmit={async (event) => {
        event.preventDefault();
        const isComicHorror = form.niche === "horror" && form.genre === "2d_comic_horror";
        const ok = await create({
          ...form,
          niche: isComicHorror ? "horror_comic" : form.niche,
          genre: isComicHorror ? "analog_horror" : form.genre,
          gameplayKey: form.gameplayKey || undefined,
          imageModel: form.imageModel || undefined,
          horrorAudioKey: form.horrorAudioKey || undefined,
        });
        if (ok) onCreated?.();
      }}
    >
      <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
        <strong className="text-[15px] text-foreground">Create New Reel</strong>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => void load()}>
            <RefreshCw size={16} />
            Refresh
          </Button>
          <Button type="submit" variant="default" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />}
            Create Reel
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(150px,1fr)_minmax(160px,1fr)_minmax(145px,0.8fr)_minmax(120px,0.6fr)_minmax(90px,0.45fr)]">
        <Label>
          Niche
          <Select
            value={form.niche}
            onChange={(event) => {
              const niche = event.target.value;
              const genres = NICHE_GENRES[niche] ?? [];
              setForm({ ...form, niche, genre: genres[0] });
            }}
          >
            {NICHES.map((niche) => (
              <option key={niche.value} value={niche.value}>
                {niche.label}
              </option>
            ))}
          </Select>
        </Label>
        <Label>
          Genre
          <Select value={form.genre} onChange={(event) => setForm({ ...form, genre: event.target.value })}>
            {genreOptions.map((genre) => (
              <option key={genre} value={genre}>
                {formatLabel(genre)}
              </option>
            ))}
          </Select>
        </Label>
        <Label>
          Source
          <Select
            value={form.source}
            onChange={(event) => setForm({ ...form, source: event.target.value as CreateReelInput["source"] })}
          >
            <option value="hybrid">hybrid</option>
            <option value="llm">llm</option>
            <option value="verbatim">verbatim</option>
          </Select>
        </Label>
        <Label>
          Tier
          <Select
            value={form.tier}
            onChange={(event) => setForm({ ...form, tier: event.target.value as CreateReelInput["tier"] })}
          >
            <option value="cheap">cheap</option>
            <option value="value">value</option>
            <option value="premium">premium</option>
          </Select>
        </Label>
        <Label>
          Parts
          <Select
            value={String(form.parts)}
            onChange={(event) => setForm({ ...form, parts: parsePartsValue(event.target.value) })}
          >
            <option value="off">1</option>
            <option value="auto">auto</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </Select>
        </Label>
      </div>

      <Label>
        Source Post
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => {
              setTopicMode("auto");
              setForm((current) => ({ ...current, topic: "auto" }));
            }}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-bold",
              topicMode === "auto" ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-accent"
            )}
          >
            Auto
          </button>
          <button
            type="button"
            onClick={() => {
              setTopicMode("custom");
              setForm((current) => ({ ...current, topic: "" }));
            }}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-bold",
              topicMode === "custom" ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-accent"
            )}
          >
            Custom Topic
          </button>
        </div>

        {topicMode === "auto" ? (
          <p className="m-0 rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {isGameplayNiche
              ? "Pulls the next fresh, unused story from the topped-up bank for this genre — or generates one on the spot if the bank is empty. You don't need to type anything; this is the default for high-volume posting."
              : "The scriptwriter picks a topic on its own, informed by this genre's trending patterns. You don't need to type anything."}
            {resolvedDefaults?.scriptModel ? (
              <span className="mt-1 block font-bold text-foreground">
                Scriptwriter: {modelDisplayName(resolvedDefaults.scriptModel)}
              </span>
            ) : null}
          </p>
        ) : (
          <div className="grid gap-1.5">
            <Input
              value={form.topic ?? ""}
              onChange={(event) => setForm({ ...form, topic: event.target.value })}
              placeholder={isGameplayNiche ? "e.g. a dispute over splitting a wedding gift" : "e.g. an abandoned hospital wing that shouldn't be there"}
              autoFocus
            />
            {resolvedDefaults?.scriptModel ? (
              <p className="m-0 text-xs font-bold text-muted-foreground">
                Scriptwriter: {modelDisplayName(resolvedDefaults.scriptModel)}
              </p>
            ) : null}
          </div>
        )}
      </Label>

      {isGameplayNiche && (
        <Label>
          Gameplay Background
          <Select
            value={form.gameplayKey ?? ""}
            onChange={(event) => setForm({ ...form, gameplayKey: event.target.value })}
          >
            <option value="">Random from S3 pool</option>
            {gameplayClips.map((clip) => (
              <option key={clip.key} value={clip.key}>
                {clip.filename}
              </option>
            ))}
          </Select>
        </Label>
      )}

      {form.niche.startsWith("horror") && (
        <Label>
          Horror Background Audio
          <Select
            value={form.horrorAudioKey ?? ""}
            onChange={(event) => setForm({ ...form, horrorAudioKey: event.target.value || undefined })}
          >
            <option value="">Random from horror library</option>
            {horrorAudios.map((audio) => (
              <option key={audio.key} value={audio.key}>
                {audio.label}
                {audio.license ? ` · ${audio.license.toUpperCase()}` : ""}
              </option>
            ))}
          </Select>
          <div className="rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {selectedHorrorAudio ? (
              <div className="grid gap-2">
                <div>
                  <strong className="text-foreground">{selectedHorrorAudio.label}</strong>
                  {selectedHorrorAudio.license ? ` · ${selectedHorrorAudio.license.toUpperCase()}` : ""}
                </div>
                <audio controls preload="none" src={selectedHorrorAudio.url} className="h-8 w-full" />
              </div>
            ) : (
              "Uses a random CC0/Public Domain horror bed from S3 and mixes it quietly under narration."
            )}
          </div>
        </Label>
      )}

      {!isGameplayNiche && (
        <Label>
          Image Model
          <Select
            value={form.imageModel ?? ""}
            onChange={(event) => setForm({ ...form, imageModel: event.target.value })}
          >
            <option value="">Tier default</option>
            {imageModels.map((option: ImageModelOption) => (
              <option key={option.model} value={option.model}>
                {option.label} · {option.priceLabel}
                {option.supportsReferenceArt ? " · ref-art ✓" : ""}
              </option>
            ))}
          </Select>
          <p className="m-0 rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {selectedImageModel
              ? `${selectedImageModel.priceLabel}. ${selectedImageModel.priceNote}`
              : "Uses the niche/tier default image model. Exact request cost is captured after generation when OpenRouter exposes usage."}
          </p>
          {refArtModelWarning ? (
            <p className="m-0 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-bold text-warning-foreground">
              This image model can’t follow reference art — the selected art style will be applied by prompt only. Pick a “ref-art ✓” model to use the reference images.
            </p>
          ) : null}
        </Label>
      )}

      {isHorrorNiche && (
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <span className="text-xs font-bold text-foreground/80">Animation Art Style</span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setForm({ ...form, artStyleId: undefined })}
                className={cn(
                  "w-28 shrink-0 rounded-lg border p-2 text-left",
                  !form.artStyleId ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                )}
              >
                <div className="grid aspect-square w-full place-items-center rounded-md bg-muted text-muted-foreground">
                  <Shuffle size={20} />
                </div>
                <span className="mt-1 block text-xs font-bold text-foreground">Auto (rotate)</span>
              </button>
              {horrorArtStyles.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setForm({ ...form, artStyleId: style.id })}
                  className={cn(
                    "w-28 shrink-0 rounded-lg border p-2 text-left",
                    form.artStyleId === style.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                  )}
                >
                  {style.thumbnailUrl ? (
                    <img
                      src={style.thumbnailUrl}
                      alt={style.displayName}
                      loading="lazy"
                      className="aspect-square w-full rounded-md border border-border object-cover"
                    />
                  ) : (
                    <div className="grid aspect-square w-full place-items-center rounded-md bg-muted text-center text-[10px] text-muted-foreground">
                      prompt-only
                    </div>
                  )}
                  <span className="mt-1 block truncate text-xs font-bold text-foreground">{style.displayName}</span>
                </button>
              ))}
            </div>
            <p className="m-0 text-xs leading-relaxed text-muted-foreground">
              {selectedArtStyle
                ? `${selectedArtStyle.description}${selectedArtStyle.attribution?.[0]?.title ? ` · ref: ${selectedArtStyle.attribution[0].title} (${selectedArtStyle.attribution[0].license ?? "PD"})` : ""}`
                : "Auto rotates a style per video (anti-slop). A selected style's reference art steers the look on ref-art ✓ image models."}
            </p>
          </div>

          <Label>
            Motion
            <Select
              value={motionMode}
              onChange={(event) =>
                setForm({ ...form, motionMode: event.target.value as CreateReelInput["motionMode"] })
              }
            >
              {MOTION_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </Select>
            <p className="m-0 rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {MOTION_MODES.find((mode) => mode.value === motionMode)?.hint}
            </p>
          </Label>
        </div>
      )}

      <Label>
        Voice
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => {
              setVoiceMode("default");
              setForm((current) => ({ ...current, ttsModel: undefined, ttsVoice: undefined, ttsFormat: undefined }));
            }}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-bold",
              voiceMode === "default" ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-accent"
            )}
          >
            Tier Default
          </button>
          <button
            type="button"
            onClick={() => setVoiceMode("custom")}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-bold",
              voiceMode === "custom" ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-accent"
            )}
          >
            Choose Voice
          </button>
        </div>

        {voiceMode === "default" ? (
          <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {resolvedDefaults?.tts ? (
              <>
                <div className="font-extrabold text-foreground">Default voice: {resolvedDefaults.tts.label}</div>
                <div className="mt-1">
                  {resolvedDefaults.tts.provider ?? resolvedDefaults.tts.model} · {resolvedDefaults.tts.voice} ·{" "}
                  {resolvedDefaults.tts.format}
                </div>
                <div className="mt-1">
                  Unit economics: {resolvedDefaults.tts.priceLabel ?? "usage-priced"}
                  {resolvedDefaults.tts.unitPriceLabel ? ` · ${resolvedDefaults.tts.unitPriceLabel}` : ""}
                </div>
                {resolvedDefaults.tts.priceNote ? <div className="mt-1">{resolvedDefaults.tts.priceNote}</div> : null}
              </>
            ) : (
              "Uses the selected tier's default TTS model/voice, plus niche overrides when configured."
            )}
          </div>
        ) : (
          <div className="grid gap-2">
            {selectedVoice ? (
              <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs leading-relaxed">
                <div className="font-extrabold text-primary">Selected voice: {selectedVoice.label}</div>
                <div className="mt-1 text-muted-foreground">
                  {selectedVoice.provider ?? selectedVoice.model} · {selectedVoice.voice} · {selectedVoice.format}
                </div>
                <div className="mt-1 text-muted-foreground">
                  Unit economics: {selectedVoice.priceLabel ?? "usage-priced"}
                  {selectedVoice.unitPriceLabel ? ` · ${selectedVoice.unitPriceLabel}` : ""}
                </div>
                {selectedVoice.priceNote ? (
                  <div className="mt-1 text-muted-foreground">{selectedVoice.priceNote}</div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-bold text-warning-foreground">
                No custom voice selected yet.
              </div>
            )}
            <VoicePickerList
              isSelected={(option: TtsVoiceOption) => form.ttsModel === option.model && form.ttsVoice === option.voice}
              onToggle={(option: TtsVoiceOption) => {
                const alreadySelected = form.ttsModel === option.model && form.ttsVoice === option.voice;
                setForm((current) => ({
                  ...current,
                  ttsModel: alreadySelected ? undefined : option.model,
                  ttsVoice: alreadySelected ? undefined : option.voice,
                  ttsFormat: alreadySelected ? undefined : option.format,
                }));
              }}
              selectedLabel="Selected"
              unselectedLabel="Use"
            />
          </div>
        )}
      </Label>

      {isGameplayNiche && (
        <div className="grid gap-1.5">
          <span className="text-xs font-bold text-foreground/80">Preview</span>
          {selectedClip ? (
            <div className="grid w-fit gap-1.5">
              <video
                key={selectedClip.key}
                className="aspect-[9/16] h-64 rounded-lg border border-border bg-black object-cover"
                src={selectedClip.url}
                muted
                loop
                autoPlay
                playsInline
                controls
              />
              <span className="max-w-64 truncate text-xs text-muted-foreground">{selectedClip.filename}</span>
            </div>
          ) : (
            <div className="grid aspect-[9/16] h-64 place-items-center gap-2 rounded-lg border border-dashed border-border text-muted-foreground">
              <Shuffle size={22} />
              <span className="max-w-40 text-center text-xs leading-relaxed">
                A random clip from the S3 pool will be picked at render time
              </span>
            </div>
          )}
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Film size={13} /> {gameplayClips.length} clip{gameplayClips.length === 1 ? "" : "s"} in the pool
          </span>
        </div>
      )}
    </form>
  );
}
