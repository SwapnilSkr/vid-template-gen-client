import { Loader2, RefreshCw, Volume2, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  listGameplay,
  regenerateReel,
  updateRedditCard,
  updateReelSettings,
  updateScene,
  type GameplayClip,
  type Reel,
} from "@/api/reels";
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
} from "@/utils/reel";

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

  return (
    <div className="grid gap-3">
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

