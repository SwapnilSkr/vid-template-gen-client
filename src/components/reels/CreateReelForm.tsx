import { Film, Loader2, RefreshCw, Shuffle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { CreateReelInput, TtsVoiceOption } from "@/api/reels";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { panelClassName } from "@/components/ui/panel";
import { REEL_GENRES } from "@/constants/reels";
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
};

interface CreateReelFormProps {
  /** Called after a reel is successfully created (e.g. to navigate away). */
  onCreated?: () => void;
}

export function CreateReelForm({ onCreated }: CreateReelFormProps = {}) {
  const create = useReelStudio((state) => state.create);
  const loading = useReelStudio((state) => state.loading);
  const load = useReelStudio((state) => state.load);
  const gameplayClips = useReelStudio((state) => state.gameplayClips);
  const loadGameplay = useReelStudio((state) => state.loadGameplay);
  const [form, setForm] = useState<CreateReelInput>(defaultForm);
  const [topicMode, setTopicMode] = useState<"auto" | "custom">("auto");
  const [voiceMode, setVoiceMode] = useState<"default" | "custom">("default");

  useEffect(() => {
    void loadGameplay();
  }, [loadGameplay]);

  const selectedClip = gameplayClips.find((clip) => clip.key === form.gameplayKey);

  return (
    <form
      className={cn(panelClassName, "mb-2.5 grid gap-3 p-4")}
      onSubmit={async (event) => {
        event.preventDefault();
        const ok = await create({ ...form, gameplayKey: form.gameplayKey || undefined });
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
          <Select value={form.niche} onChange={(event) => setForm({ ...form, niche: event.target.value })}>
            <option value="reddit">Reddit Stories</option>
          </Select>
        </Label>
        <Label>
          Genre
          <Select value={form.genre} onChange={(event) => setForm({ ...form, genre: event.target.value })}>
            {REEL_GENRES.map((genre) => (
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
            Pulls the next fresh, unused story from the topped-up bank for this genre — or generates one on
            the spot if the bank is empty. You don't need to type anything; this is the default for
            high-volume posting.
          </p>
        ) : (
          <Input
            value={form.topic ?? ""}
            onChange={(event) => setForm({ ...form, topic: event.target.value })}
            placeholder="e.g. a dispute over splitting a wedding gift"
            autoFocus
          />
        )}
      </Label>

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
          <p className="m-0 rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            Uses the selected tier's default TTS model/voice (or the genre's voice override, if it has one).
          </p>
        ) : (
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
        )}
      </Label>

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
    </form>
  );
}
