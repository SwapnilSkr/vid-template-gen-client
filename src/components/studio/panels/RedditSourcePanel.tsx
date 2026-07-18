import { Loader2, RefreshCw, Wand2, BookOpen } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  listGameplay,
  replanReel,
  replanReelSeries,
  restructureSeriesParts,
  regenerateReel,
  updateRedditCard,
  updateReelSettings,
  type GameplayClip,
  type Reel,
} from "@/api/reels";
import type { StorySource } from "@/api/stories";
import {
  storySelectionToCreateFields,
  type StorySelection,
} from "@/components/reels/StoryPickerStep";
import { CostChip, RenderCacheStatus, describeRenderCost } from "@/components/reels/RenderCostHint";
import type { ConfirmAction, StudioRun } from "@/components/studio/types";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelTitle } from "@/components/ui/panel";
import {
  canCompositeOnlyRerender,
  canOutroOnlyRerender,
  gameplayMissingTtsSegmentCount,
  gameplayNarrationCacheReady,
  gameplayRerenderCostsCredits,
  parsePartsValue,
} from "@/utils/reel";

type ReplanScope = "episode" | "series";
type SeriesParts = "off" | "auto" | number;

const StoryPickerStep = lazy(() =>
  import("@/components/reels/StoryPickerStep").then((module) => ({
    default: module.StoryPickerStep,
  }))
);

function reelStorySource(reel: Reel): StorySource {
  const raw = reel.source ?? reel.storySource ?? "hybrid";
  if (raw === "llm" || raw === "hybrid" || raw === "verbatim") return raw;
  return "hybrid";
}

function defaultSeriesParts(reel: Reel): SeriesParts {
  if (reel.partCount && reel.partCount > 1) return reel.partCount;
  return "auto";
}

function isMultiPartSeries(reel: Reel): boolean {
  return Boolean(reel.seriesId && (reel.partCount ?? 1) > 1);
}

export function RedditSourcePanel({
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
  const reelKey = reel._id ?? reel.id ?? "";
  const story = reel.redditStory;
  const [title, setTitle] = useState(story?.title ?? reel.title ?? "");
  const [subreddit, setSubreddit] = useState(story?.subreddit ?? "");
  const [cardUsername, setCardUsername] = useState(story?.cardUsername ?? story?.author ?? "");
  const [ageHours, setAgeHours] = useState(String(story?.ageHours ?? ""));
  const [upvotes, setUpvotes] = useState(String(story?.upvotes ?? ""));
  const [comments, setComments] = useState(String(story?.comments ?? ""));
  const [clips, setClips] = useState<GameplayClip[]>([]);
  const [gameplayKey, setGameplayKey] = useState(reel.gameplayKey ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [storySelection, setStorySelection] = useState<StorySelection | null>(null);
  const [replanScope, setReplanScope] = useState<ReplanScope>(() =>
    isMultiPartSeries(reel) ? "series" : "episode"
  );
  const [seriesParts, setSeriesParts] = useState<SeriesParts>(() => defaultSeriesParts(reel));
  const [restructureTo, setRestructureTo] = useState<SeriesParts>(() => defaultSeriesParts(reel));

  useEffect(() => {
    setReplanScope(isMultiPartSeries(reel) ? "series" : "episode");
    setSeriesParts(defaultSeriesParts(reel));
    setRestructureTo(defaultSeriesParts(reel));
  }, [reel._id, reel.id, reel.seriesId, reel.partCount]);

  useEffect(() => {
    setTitle(story?.title ?? reel.title ?? "");
    setSubreddit(story?.subreddit ?? "");
    setCardUsername(story?.cardUsername ?? story?.author ?? "");
    setAgeHours(String(story?.ageHours ?? ""));
    setUpvotes(String(story?.upvotes ?? ""));
    setComments(String(story?.comments ?? ""));
    setGameplayKey(reel.gameplayKey ?? "");
  }, [story, reel.title, reel.gameplayKey]);

  useEffect(() => {
    void listGameplay()
      .then(setClips)
      .catch(() => setClips([]));
  }, []);

  const cardDirty =
    title !== (story?.title ?? reel.title ?? "") ||
    subreddit !== (story?.subreddit ?? "") ||
    cardUsername !== (story?.cardUsername ?? story?.author ?? "") ||
    ageHours !== String(story?.ageHours ?? "") ||
    upvotes !== String(story?.upvotes ?? "") ||
    comments !== String(story?.comments ?? "");

  const parseOptionalInt = (value: string) => {
    if (!value.trim()) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : undefined;
  };

  const canBakeIntoVideo =
    reel.status === "completed" || reel.status === "failed";

  async function saveTitleCard(andRerender: boolean) {
    const titleChanged = title.trim() !== (story?.title ?? reel.title ?? "").trim();
    const visualOnly = cardDirty && !titleChanged;
    const freeComposite = visualOnly && gameplayNarrationCacheReady(reel);

    if (andRerender) {
      const missing = titleChanged
        ? Math.max(1, gameplayMissingTtsSegmentCount({ ...reel, titleAudioUrl: undefined }))
        : gameplayMissingTtsSegmentCount(reel);
      requestConfirm({
        title: freeComposite ? "Bake title card (free)?" : "Save title card & re-render?",
        body: freeComposite
          ? "Visual card fields only. Reuses cached narration — no OpenRouter TTS."
          : gameplayRerenderCostsCredits(reel) || titleChanged
            ? `Re-composites the gameplay reel. About ${missing} narration segment(s) may spend OpenRouter TTS.`
            : "Reuses cached title and sentence narration. Only the Reddit card overlay and composite are rebuilt.",
        details: freeComposite
          ? [
              "Subreddit, username, upvotes, comments, and age do not re-TTS.",
              "Spoken title text is unchanged.",
            ]
          : titleChanged
            ? [
                "Title text changed — title narration will be regenerated.",
                "Unchanged sentence audio is reused when cached.",
              ]
            : ["Narration audio is already cached on this reel."],
        confirmLabel: freeComposite
          ? "Bake card (free)"
          : missing > 0
            ? `Spend credits (~${missing} TTS) & re-render`
            : "Re-render title card",
        costTone: freeComposite || missing === 0 ? "free" : "paid",
        onConfirm: () =>
          run(async () => {
            await updateRedditCard(reelKey, {
              title: title.trim(),
              subreddit,
              cardUsername,
              ageHours: parseOptionalInt(ageHours),
              upvotes: parseOptionalInt(upvotes),
              comments: parseOptionalInt(comments),
            });
            return regenerateReel(
              reelKey,
              freeComposite || (!titleChanged && gameplayNarrationCacheReady(reel))
                ? "composite_only"
                : "render_only"
            );
          }),
      });
      return;
    }
    await run(() =>
      updateRedditCard(reelKey, {
        title: title.trim(),
        subreddit,
        cardUsername,
        ageHours: parseOptionalInt(ageHours),
        upvotes: parseOptionalInt(upvotes),
        comments: parseOptionalInt(comments),
      }),
    );
  }

  const titleChangedPreview = title.trim() !== (story?.title ?? reel.title ?? "").trim();
  const bakeIntent = !titleChangedPreview && gameplayNarrationCacheReady(reel) ? "composite" : "full";
  const storySource = reelStorySource(reel);
  const canReplanStory = reel.status === "plan_review" || reel.status === "completed" || reel.status === "failed";
  const pickerParts = replanScope === "series" ? seriesParts : "off";
  const episodeCount =
    replanScope === "series" && seriesParts !== "off"
      ? isMultiPartSeries(reel)
        ? reel.partCount ?? 2
        : typeof seriesParts === "number"
          ? seriesParts
          : undefined
      : 1;

  const confirmReplanWithStory = () => {
    if (!storySelection) return;
    const seriesMode = replanScope === "series";
    const fields = storySelectionToCreateFields(storySelection);
    requestConfirm({
      title: seriesMode ? "Re-plan whole series?" : "Re-plan with this story?",
      body: seriesMode
        ? "Discards plans for every episode and runs story planning again from one selected thread."
        : "Discards the current plan and runs OpenRouter story planning again.",
      details: [
        "LLM planning credits will be charged.",
        seriesMode
          ? `All ${episodeCount ? `~${episodeCount} ` : ""}episodes are cleared until you approve and produce again.`
          : "Existing scene assets are cleared until you approve and produce again.",
        seriesMode ? "Other episodes in this series will use the new story arc." : undefined,
      ].filter((line): line is string => Boolean(line)),
      confirmLabel: "Spend credits & re-plan",
      costTone: "paid",
      onConfirm: () =>
        run(() =>
          seriesMode
            ? replanReelSeries(reelKey, { ...fields, parts: seriesParts })
            : replanReel(reelKey, fields)
        ),
    });
  };

  return (
    <div className="grid gap-3">
      <PanelTitle className="text-foreground">Story source</PanelTitle>
      {story ? (
        <div className="rounded-md border border-border bg-card p-2.5 text-xs">
          <div className="font-medium text-foreground">{story.title ?? reel.title}</div>
          {story.subreddit ? (
            <div className="mt-1 text-muted-foreground">{story.subreddit}</div>
          ) : null}
          {story.seedUrl ? (
            <a
              href={story.seedUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-primary no-underline hover:underline"
            >
              View source post
            </a>
          ) : null}
        </div>
      ) : (
        <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
          Story will be planned from your topic or bank selection.
        </p>
      )}

      {canReplanStory ? (
        <div className="grid gap-2 rounded-lg border border-border bg-black/15 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <BookOpen size={16} />
              Pick another story
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setPickerOpen((open) => !open)}
            >
              {pickerOpen ? "Hide picker" : "Browse"}
            </Button>
          </div>
          {pickerOpen ? (
            <Suspense
              fallback={
                <div className="rounded-md border border-border bg-muted px-3 py-3 text-xs text-muted-foreground">
                  Loading story picker…
                </div>
              }
            >
              <div className="grid gap-2">
                <div className="grid gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground">Re-plan scope</span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={replanScope === "episode" ? "default" : "outline"}
                      disabled={busy}
                      onClick={() => setReplanScope("episode")}
                    >
                      This episode only
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={replanScope === "series" ? "default" : "outline"}
                      disabled={busy}
                      onClick={() => setReplanScope("series")}
                    >
                      Whole series
                    </Button>
                  </div>
                  {replanScope === "series" ? (
                    <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
                      Splits the selected story across episodes and updates every part in this series.
                      {isMultiPartSeries(reel)
                        ? " Extra episodes are removed or added if the part count changes."
                        : " Creates a multi-part series when the story is long enough."}
                    </p>
                  ) : (
                    <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
                      Only this reel changes. Sibling episodes keep their current stories.
                    </p>
                  )}
                </div>
                {replanScope === "series" ? (
                  <Label>
                    Parts
                    <Select
                      value={String(seriesParts)}
                      onChange={(event) => setSeriesParts(parsePartsValue(event.target.value))}
                    >
                      <option value="off">1 (no split)</option>
                      <option value="auto">auto</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                    </Select>
                  </Label>
                ) : null}
                <StoryPickerStep
                  compact
                  genre={reel.genre ?? "aita_family"}
                  source={storySource}
                  tier={reel.tier}
                  parts={pickerParts}
                  selection={storySelection}
                  onSelect={setStorySelection}
                />
              </div>
            </Suspense>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !storySelection}
            onClick={confirmReplanWithStory}
          >
            <Wand2 size={15} />
            {replanScope === "series" ? "Re-plan whole series" : "Re-plan with selected story"}
          </Button>
        </div>
      ) : null}

      {canReplanStory ? (
        <div className="grid gap-2 rounded-lg border border-border bg-black/15 p-3">
          <span className="text-sm font-semibold text-foreground">Series structure</span>
          <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
            An AI editor assesses the assembled story&apos;s duration, balanced scene count, and available cliffhangers. Its measured LLM cost appears in the ledger; the result is cached until the story changes.
            Re-split keeps the same words; each reel stays ~1–2 min.
            {isMultiPartSeries(reel) ? " Applies across every episode." : " Splits this reel into a series."}
          </p>
          <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
            The AI recommendation and the required “Keep current plan” / “Use recommendation” decision appear in the Generate reel confirmation, where the choice is applied immediately before paid production.
          </p>
          <div className="flex items-end gap-2">
            <Label className="flex-1">
              Parts
              <Select
                value={String(restructureTo)}
                disabled={busy}
                onChange={(event) => setRestructureTo(parsePartsValue(event.target.value))}
              >
                <option value="auto">Auto (by length)</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
                <option value="9">9</option>
                <option value="10">10</option>
                <option value="11">11</option>
                <option value="12">12</option>
              </Select>
            </Label>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                requestConfirm({
                  title: "Restructure series?",
                  body: "Re-splits the current story across the chosen number of parts, keeping your words.",
                  details: [
                    "LLM cut-selection credits will be charged.",
                    "Every affected episode is re-planned; scene assets are cleared until you approve and produce again.",
                  ],
                  confirmLabel: "Spend credits & restructure",
                  costTone: "paid",
                  onConfirm: () =>
                    run(() => restructureSeriesParts(reelKey, restructureTo === "off" ? 1 : restructureTo)),
                })
              }
            >
              <Wand2 size={15} /> Re-split
            </Button>
          </div>
        </div>
      ) : null}

      <PanelTitle className="text-foreground">Title card</PanelTitle>
      <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
        Shown over gameplay while the title is spoken. Saving metadata is free —
        baking into the video reuses cached narration when possible.
      </p>

      <RenderCacheStatus reel={reel} intent={bakeIntent} />

      <Label className="gap-1 text-xs text-muted-foreground">
        Title
        <span className="ml-1 font-normal text-muted-foreground/70">(spoken · may cost TTS if changed)</span>
        <Input
          value={title}
          disabled={busy}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Label>
      <div className="grid grid-cols-2 gap-2">
        <Label className="gap-1 text-xs text-muted-foreground">
          Subreddit
          <span className="ml-1 font-normal text-muted-foreground/70">(visual only)</span>
          <Input
            value={subreddit}
            disabled={busy}
            placeholder="r/AmItheAsshole"
            onChange={(e) => setSubreddit(e.target.value)}
          />
        </Label>
        <Label className="gap-1 text-xs text-muted-foreground">
          Username
          <span className="ml-1 font-normal text-muted-foreground/70">(visual only)</span>
          <Input
            value={cardUsername}
            disabled={busy}
            placeholder="u/throwaway_1234"
            onChange={(e) => setCardUsername(e.target.value)}
          />
        </Label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Label className="gap-1 text-xs text-muted-foreground">
          Age (hours)
          <Input
            type="number"
            min={0}
            value={ageHours}
            disabled={busy}
            onChange={(e) => setAgeHours(e.target.value)}
          />
        </Label>
        <Label className="gap-1 text-xs text-muted-foreground">
          Upvotes
          <Input
            type="number"
            min={0}
            value={upvotes}
            disabled={busy}
            onChange={(e) => setUpvotes(e.target.value)}
          />
        </Label>
        <Label className="gap-1 text-xs text-muted-foreground">
          Comments
          <Input
            type="number"
            min={0}
            value={comments}
            disabled={busy}
            onChange={(e) => setComments(e.target.value)}
          />
        </Label>
      </div>
      <p className="m-0 text-[10px] text-muted-foreground/70">
        Age, upvotes, and comments are visual-only — baking them never re-TTS.
      </p>
      <div className="grid gap-2">
        <Button
          type="button"
          variant={cardDirty ? "default" : "outline"}
          disabled={busy || !cardDirty || !title.trim()}
          onClick={() => void saveTitleCard(false)}
        >
          {cardDirty ? "Save title card" : "Saved"}
        </Button>
        {canBakeIntoVideo ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !title.trim()}
            onClick={() => void saveTitleCard(true)}
          >
            {busy ? (
              <Loader2 className="animate-spin" size={15} />
            ) : (
              <RefreshCw size={15} />
            )}
            {cardDirty
              ? title.trim() === (story?.title ?? reel.title ?? "").trim() &&
                gameplayNarrationCacheReady(reel)
                ? "Save & bake card · free"
                : "Save & re-render video"
              : gameplayNarrationCacheReady(reel)
                ? "Re-bake title card · free"
                : "Re-render title card into video"}
          </Button>
        ) : null}
      </div>

      <PanelTitle className="mt-2 text-foreground">Gameplay clip</PanelTitle>
      <Label className="gap-1 text-xs text-muted-foreground">
        Background
        <Select
          disabled={busy}
          value={gameplayKey}
          onChange={(e) => {
            const next = e.target.value;
            setGameplayKey(next);
            void run(() =>
              updateReelSettings(reelKey, {
                gameplayKey: next || undefined,
              }),
            );
          }}
        >
          <option value="">Random from S3 pool</option>
          {clips.map((clip) => (
            <option key={clip.key} value={clip.key}>
              {clip.filename}
            </option>
          ))}
        </Select>
      </Label>
      {canBakeIntoVideo ? (
        <p className="m-0 text-[11px] leading-relaxed text-muted-foreground/80">
          Clip choice is saved immediately. Use{" "}
          <span className="font-medium text-foreground">
            Re-render title card into video
          </span>{" "}
          above (or Export → Re-render) to bake the new background — that
          re-runs TTS with the current studio voice.
        </p>
      ) : null}
    </div>
  );
}
