import { Film, Loader2, RefreshCw, Shuffle, Sparkles, UserCircle, Youtube } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getReelDefaults, type CreateReelInput, type ImageModelOption, type ReelDefaults, type TtsVoiceOption, type YouTubeChannelOption } from "@/api/reels";
import { listHorrorReferences, type HorrorReference } from "@/api/trends";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { panelClassName } from "@/components/ui/panel";
import { MOTION_MODES, NICHE_GENRES, NICHES } from "@/constants/reels";
import { cn } from "@/lib/utils";
import { useReelStudio } from "@/store/reel-studio";
import { formatLabel, parsePartsValue } from "@/utils/reel";
import { EditEffectsControls } from "./EditEffectsControls";
import { VoicePickerList } from "./VoicePickerList";

/** The Lurker house look — the out-of-box art style for horror reels. Mirrors
 *  the lead entry in server/src/config/art-styles.ts. */
const DEFAULT_HORROR_ART_STYLE_ID = "classic_horror_comic";

const defaultForm: CreateReelInput = {
  niche: "reddit",
  genre: "aita_family",
  topic: "auto",
  tier: "cheap",
  source: "hybrid",
  parts: "off",
  gameplayKey: "",
  thumbnailMode: "frame",
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

function imageModelCostSummary(option: ImageModelOption | undefined, sceneCount: number): string {
  if (!option) return "Uses the niche/tier default image model. Exact request cost is captured after generation when OpenRouter exposes usage.";
  if (option.pricingType === "flat" && option.perImageUsd !== undefined) {
    return `${option.priceLabel}. Predictable image cost: about $${(option.perImageUsd * sceneCount).toFixed(3)} for ${sceneCount} scene images, plus thumbnail if generated. ${option.priceNote}`;
  }
  const probe = option.probeCostUsd !== undefined ? ` Validation probe was $${option.probeCostUsd.toFixed(4)}, but real reference-art requests can differ.` : "";
  return `${option.priceLabel}. Variable/token-priced model: final image cost can increase with prompt length or reference art.${probe} ${option.priceNote}`;
}

function channelName(channel: YouTubeChannelOption): string {
  return channel.googleChannelTitle || channel.label;
}

function channelHandle(channel: YouTubeChannelOption): string {
  return channel.googleChannelHandle
    ? channel.googleChannelHandle.replace(/^@?/, "@")
    : channel.googleChannelId
      ? `ID ${channel.googleChannelId}`
      : channel.source === "env"
        ? "Server default"
        : "Connected account";
}

function channelPurpose(channel: YouTubeChannelOption): string {
  const niches = channel.niches ?? [];
  if (niches.some((niche) => niche.startsWith("horror"))) return "Horror";
  if (niches.some((niche) => niche.startsWith("reddit") || niche === "aita")) return "Reddit";
  return channel.isDefault ? "Default" : "General";
}

function pickSuggestedOutroChannel(
  channels: YouTubeChannelOption[],
  niche: string,
  genre?: string
): YouTubeChannelOption | undefined {
  const wanted = niche.startsWith("horror")
    ? ["horror", "horror_comic", genre ?? ""]
    : niche === "reddit"
      ? ["reddit", "reddit_stories", "aita"]
      : [];
  const normalized = wanted.filter(Boolean);
  return (
    channels.find((channel) =>
      (channel.niches ?? []).some((tag) => normalized.includes(tag.toLowerCase()))
    ) ??
    channels.find((channel) => channel.isDefault) ??
    channels[0]
  );
}

export function CreateReelForm({ onCreated }: CreateReelFormProps = {}) {
  const create = useReelStudio((state) => state.create);
  const loading = useReelStudio((state) => state.loading);
  const load = useReelStudio((state) => state.load);
  const gameplayClips = useReelStudio((state) => state.gameplayClips);
  const horrorAudios = useReelStudio((state) => state.horrorAudios);
  const imageModels = useReelStudio((state) => state.imageModels);
  const artStyles = useReelStudio((state) => state.artStyles);
  const youtubeChannels = useReelStudio((state) => state.youtubeChannels);
  const loadGameplay = useReelStudio((state) => state.loadGameplay);
  const loadHorrorAudio = useReelStudio((state) => state.loadHorrorAudio);
  const loadImageModels = useReelStudio((state) => state.loadImageModels);
  const loadArtStyles = useReelStudio((state) => state.loadArtStyles);
  const loadYouTubeChannels = useReelStudio((state) => state.loadYouTubeChannels);
  const [form, setForm] = useState<CreateReelInput>(defaultForm);
  const [topicMode, setTopicMode] = useState<"auto" | "custom">("auto");
  const [voiceMode, setVoiceMode] = useState<"default" | "custom">("default");
  const [resolvedDefaults, setResolvedDefaults] = useState<ReelDefaults | undefined>();
  const [horrorReferences, setHorrorReferences] = useState<HorrorReference[]>([]);
  const isGameplayNiche = form.niche === "reddit"; // only gameplay_overlay niches use a gameplay background
  const isHorrorNiche = form.niche.startsWith("horror");

  useEffect(() => {
    void loadGameplay();
    void loadHorrorAudio();
    void loadImageModels();
    void loadArtStyles();
    void loadYouTubeChannels();
  }, [loadGameplay, loadHorrorAudio, loadImageModels, loadArtStyles, loadYouTubeChannels]);

  useEffect(() => {
    if (!isHorrorNiche) return;
    let cancelled = false;
    void listHorrorReferences(20)
      .then((references) => {
        if (!cancelled) setHorrorReferences(references);
      })
      .catch(() => {
        if (!cancelled) setHorrorReferences([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isHorrorNiche]);

  // Seed the house look for horror: default the art style to the Lurker look
  // (classic_horror_comic). Voice/captions/motion/audio-FX are seeded silently
  // server-side from the default recipe and stay editable in the Studio.
  useEffect(() => {
    if (!form.niche.startsWith("horror") || form.artStyleId) return;
    setForm((current) => ({ ...current, artStyleId: DEFAULT_HORROR_ART_STYLE_ID }));
  }, [form.niche, form.artStyleId]);

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
  const selectedOutroChannel = youtubeChannels.find((channel) => channel.id === form.outroChannelId);
  const selectedImageModel = imageModels.find((option) => option.model === form.imageModel);
  const selectedHorrorReference = horrorReferences.find((reference) => reference._id === form.horrorReferenceId);
  const selectedVoice = useReelStudio((state) =>
    state.ttsVoices.find((option) => option.model === form.ttsModel && option.voice === form.ttsVoice)
  );
  const genreOptions = NICHE_GENRES[form.niche] ?? [];
  const estimatedSceneCount = form.niche.startsWith("horror") ? 9 : 5;
  const horrorArtStyles = artStyles.filter((style) => style.niches.includes("horror"));
  const selectedArtStyle = horrorArtStyles.find((style) => style.id === form.artStyleId);
  const refArtModelWarning = Boolean(
    form.artStyleId && selectedImageModel && selectedImageModel.supportsReferenceArt === false
  );
  // Horror's house default is Ken Burns (mirrors the server default recipe);
  // other niches fall back to parallax.
  const motionMode = form.motionMode ?? (isHorrorNiche ? "ken_burns" : "parallax");

  const suggestedOutroChannel = useMemo(
    () => pickSuggestedOutroChannel(youtubeChannels, form.niche, form.genre),
    [form.genre, form.niche, youtubeChannels]
  );

  useEffect(() => {
    if (form.outroChannelId || !suggestedOutroChannel) return;
    setForm((current) => ({
      ...current,
      outroChannelId: current.outroChannelId || suggestedOutroChannel.id,
    }));
  }, [form.outroChannelId, suggestedOutroChannel]);

  return (
    <form
      className={cn(panelClassName, "mb-2.5 grid gap-4 p-4")}
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
          outroChannelId: form.outroChannelId || undefined,
          thumbnailMode: form.thumbnailMode ?? "frame",
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

      <div className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(130px,1fr))]">
        <Label>
          Niche
          <Select
            value={form.niche}
            onChange={(event) => {
              const niche = event.target.value;
              const genres = NICHE_GENRES[niche] ?? [];
              setForm({ ...form, niche, genre: genres[0], outroChannelId: undefined });
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
        {isGameplayNiche ? (
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
        ) : null}
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
        {(isGameplayNiche || isHorrorNiche) ? (
        <Label>
          {isHorrorNiche ? "Series" : "Parts"}
          <Select
            value={String(form.parts)}
            onChange={(event) => setForm({ ...form, parts: parsePartsValue(event.target.value) })}
          >
            <option value="off">{isHorrorNiche ? "Standalone" : "1"}</option>
            <option value="auto">{isHorrorNiche ? "Auto series" : "auto"}</option>
            <option value="2">{isHorrorNiche ? "2 episodes" : "2"}</option>
            <option value="3">{isHorrorNiche ? "3 episodes" : "3"}</option>
            <option value="4">{isHorrorNiche ? "4 episodes" : "4"}</option>
          </Select>
          {isHorrorNiche ? (
            <span className="text-[11px] font-semibold text-muted-foreground">
              Series creates separate reels grouped into one story arc; pasted stories are split into episodes.
            </span>
          ) : null}
        </Label>
        ) : null}
      </div>

      <div className="grid gap-2 rounded-lg border border-border bg-black/15 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-extrabold text-foreground">
            <Youtube size={17} />
            Brand / Outro Channel
          </span>
          <span className="text-xs font-bold text-muted-foreground">
            Recorded into this video
          </span>
        </div>
        <Label>
          Channel used in the outro
          <Select
            value={form.outroChannelId ?? ""}
            onChange={(event) => setForm({ ...form, outroChannelId: event.target.value || undefined })}
          >
            <option value="">Auto by niche</option>
            {youtubeChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channelName(channel)} · {channelPurpose(channel)} · {channel.privacyStatus}
              </option>
            ))}
          </Select>
        </Label>

        {selectedOutroChannel ? (
          <div className="flex items-center gap-3 rounded-md border border-border bg-card/70 p-2.5">
            {selectedOutroChannel.logoUrl ? (
              <img
                className="h-11 w-11 shrink-0 rounded-full border border-border object-cover"
                src={selectedOutroChannel.logoUrl}
                alt=""
              />
            ) : (
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-muted text-muted-foreground">
                <UserCircle size={24} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-extrabold text-foreground">
                {channelName(selectedOutroChannel)}
              </div>
              <div className="truncate text-xs font-semibold text-muted-foreground">
                {channelHandle(selectedOutroChannel)}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                  {channelPurpose(selectedOutroChannel)}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                  {selectedOutroChannel.privacyStatus}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="m-0 rounded-md border border-border bg-black/15 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            No channel is selected. The renderer will fall back to the niche default name unless you connect a
            YouTube channel first.
          </p>
        )}
        <p className="m-0 text-xs leading-relaxed text-muted-foreground">
          This controls the channel name, logo, and spoken outro burned into the generated video. The publish
          destination will default to this same channel later, but can still be changed before upload.
        </p>
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
          <p className="m-0 rounded-md border border-border bg-black/15 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
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
          <div className="rounded-md border border-border bg-black/15 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
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

      {isHorrorNiche && (
        <div className="grid gap-2.5 rounded-lg border border-border bg-black/15 p-3">
          <div className="grid gap-1">
            <strong className="text-[13px] text-foreground">How this reel is made</strong>
            <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
              Every horror reel starts from the house style — deep dramatic narrator, one-word ALL-CAPS
              captions, and cinematic Ken Burns motion. Your direction and reference seed the script; everything
              is editable per-scene in the Studio before image or voice spend.
            </p>
          </div>
          <label className="flex items-start gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={(form.pipelineMode ?? "review") === "review"}
              onChange={(event) =>
                setForm({ ...form, pipelineMode: event.target.checked ? "review" : "auto" })
              }
            />
            <span>
              Review &amp; edit the plan before generating
              <span className="block text-muted-foreground">
                Pauses after the cheap script/scene plan so you can edit script, art, voice, and captions in the
                Studio before any image/voice spend.
              </span>
            </span>
          </label>
          <Label className="text-xs">
            Reference story (optional)
            <Select
              value={form.horrorReferenceId ?? ""}
              onChange={(event) => setForm({ ...form, horrorReferenceId: event.target.value || undefined })}
            >
              <option value="">Auto-pick a public-domain reference</option>
              {horrorReferences.map((reference) => (
                <option key={reference._id ?? reference.sourceUrl} value={reference._id ?? ""}>
                  {reference.title}
                  {reference.author ? ` - ${reference.author}` : ""}
                  {reference.license ? ` - ${reference.license.replace(/_/g, " ")}` : ""}
                </option>
              ))}
            </Select>
            <span className="text-[11px] font-semibold text-muted-foreground">
              Used as inspiration for atmosphere, dread mechanics, and escalation shape; not copied.
            </span>
          </Label>
          {selectedHorrorReference ? (
            <div className="grid gap-1 rounded-md border border-border bg-card/70 p-2.5 text-xs">
              <div className="font-extrabold text-foreground">
                {selectedHorrorReference.title}
                {selectedHorrorReference.author ? ` - ${selectedHorrorReference.author}` : ""}
              </div>
              <p className="m-0 leading-relaxed text-muted-foreground">
                {selectedHorrorReference.promptBrief || selectedHorrorReference.excerpt}
              </p>
            </div>
          ) : null}
          <Label className="text-xs">
            Direction or story draft (optional)
            <Textarea
              rows={4}
              value={form.providedScript ?? ""}
              placeholder="e.g. An urban legend who preys on people on rainy nights. Or paste a full draft; long drafts are adapted closely and can be split into series episodes."
              onChange={(event) => setForm({ ...form, providedScript: event.target.value || undefined })}
            />
            <span className="text-[11px] font-semibold text-muted-foreground">
              Short notes guide the AI writer. Long drafts are treated as source material. You can edit the generated script in Studio before assets are produced.
            </span>
          </Label>
        </div>
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
          <p className="m-0 rounded-md border border-border bg-black/15 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {imageModelCostSummary(selectedImageModel, estimatedSceneCount)}
          </p>
          {refArtModelWarning ? (
            <p className="m-0 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-bold text-warning-foreground">
              This image model can’t follow reference art — the selected art style will be applied by prompt only. Pick a “ref-art ✓” model to use the reference images.
            </p>
          ) : null}
        </Label>
      )}

      <Label>
        Thumbnail
        <Select
          value={form.thumbnailMode ?? "frame"}
          onChange={(event) =>
            setForm({ ...form, thumbnailMode: event.target.value as CreateReelInput["thumbnailMode"] })
          }
        >
          <option value="frame">Choose video frame later (no AI image cost)</option>
          <option value="ai">Generate AI thumbnail during render</option>
        </Select>
        <p className="m-0 rounded-md border border-border bg-black/15 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          Frame mode only generates AI title, description, tags, and prompt. It does not create or upload a thumbnail until you save a selected frame in review.
        </p>
      </Label>

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
            <p className="m-0 rounded-md border border-border bg-black/15 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {MOTION_MODES.find((mode) => mode.value === motionMode)?.hint}
            </p>
          </Label>

          <div className="grid gap-2">
            <span className="text-xs font-bold text-foreground/80">Editing Effects</span>
            <EditEffectsControls
              value={form.editEffects}
              onChange={(editEffects) => setForm({ ...form, editEffects })}
            />
            <p className="m-0 text-xs leading-relaxed text-muted-foreground">
              Cinematic finish applied over the whole reel — all free to toggle and re-render later in the Studio.
            </p>
          </div>
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
                className="aspect-9/16 h-64 rounded-lg border border-border bg-black object-cover"
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
            <div className="grid aspect-9/16 h-64 place-items-center gap-2 rounded-lg border border-dashed border-border text-muted-foreground">
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
