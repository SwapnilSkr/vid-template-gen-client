import { RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  listYouTubeChannels,
  listInstagramChannels,
  regenerateOutroCommentPrompt,
  regenerateReel,
  updateReelSettings,
  type OutroSettings,
  type Reel,
  type YouTubeChannelOption,
  type InstagramChannelOption,
} from "@/api/reels";
import { RenderCacheStatus, describeRenderCost } from "@/components/reels/RenderCostHint";
import {
  OutroIncludeToggles,
  hasPartTeaser,
} from "@/components/studio/panels/OutroIncludeToggles";
import type { ConfirmAction, StudioRun } from "@/components/studio/types";
import {
  channelDisplayName,
  channelPurpose,
  compactOutroSettings,
  defaultOutroCta,
  defaultOutroSpokenLine,
} from "@/components/studio/utils";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelTitle } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import {
  canOutroOnlyRerender,
  gameplayMissingTtsSegmentCount,
  gameplayRerenderCostsCredits,
} from "@/utils/reel";

export function OutroPanel({
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
  const isPlanReview = reel.status === "plan_review";
  const [channels, setChannels] = useState<YouTubeChannelOption[]>([]);
  const [instagramChannels, setInstagramChannels] = useState<InstagramChannelOption[]>([]);
  const [outroChannelId, setOutroChannelId] = useState(reel.outroChannelId ?? "");
  const [outroInstagramChannelId, setOutroInstagramChannelId] = useState(reel.outroInstagramChannelId ?? "");
  const [outro, setOutro] = useState<OutroSettings>(reel.outro ?? {});
  // Polls continue while a render is active. Keep unsaved edits out of their
  // way, but accept an explicit server-side AI regeneration for this one field.
  const localReelKeyRef = useRef(reelKey);
  const dirtyOutroFieldsRef = useRef(new Set<keyof OutroSettings>());
  const channelsDirtyRef = useRef(false);

  useEffect(() => {
    void Promise.allSettled([listYouTubeChannels(), listInstagramChannels()]).then(([yt, ig]) => {
      setChannels(yt.status === "fulfilled" ? yt.value : []);
      setInstagramChannels(ig.status === "fulfilled" ? ig.value : []);
    });
  }, []);

  useEffect(() => {
    const reelChanged = localReelKeyRef.current !== reelKey;
    if (reelChanged) {
      localReelKeyRef.current = reelKey;
      dirtyOutroFieldsRef.current.clear();
      channelsDirtyRef.current = false;
    }
    if (reelChanged || !channelsDirtyRef.current) {
      setOutroChannelId(reel.outroChannelId ?? "");
      setOutroInstagramChannelId(reel.outroInstagramChannelId ?? "");
    }
    if (reelChanged || dirtyOutroFieldsRef.current.size === 0) {
      setOutro(reel.outro ?? {});
    }
  }, [reelKey, reel.outro, reel.outroChannelId, reel.outroInstagramChannelId]);

  const selected = channels.find((channel) => channel.id === outroChannelId);
  const selectedInstagram = instagramChannels.find((channel) => channel.id === outroInstagramChannelId);
  const outroPlatform = outroInstagramChannelId ? "instagram" : "youtube";
  const defaultCta = defaultOutroCta(outroPlatform);
  const showPartTeaser = hasPartTeaser(reel);
  const skipPartOutro = Boolean(reel.skipPartOutro);
  const skipBrandedOutro = Boolean(reel.skipBrandedOutro);
  const brandedEnabled = !skipBrandedOutro;
  const patchOutro = (patch: Partial<OutroSettings>) => {
    for (const key of Object.keys(patch) as (keyof OutroSettings)[]) {
      dirtyOutroFieldsRef.current.add(key);
    }
    setOutro((current) => ({ ...current, ...patch }));
  };
  const updateBrandAccount = (value: string) => {
    channelsDirtyRef.current = true;
    if (value.startsWith("instagram:")) {
      setOutroInstagramChannelId(value.slice("instagram:".length));
      setOutroChannelId("");
    } else {
      setOutroChannelId(value);
      setOutroInstagramChannelId("");
    }
  };
  const saveBrandCopy = async () => {
    const result = await run(() =>
      updateReelSettings(reelKey, {
        outroChannelId,
        outroInstagramChannelId,
        outro: compactOutroSettings(outro),
        skipPartOutro,
        skipBrandedOutro,
      }),
    );
    if (result.ok) {
      dirtyOutroFieldsRef.current.clear();
      channelsDirtyRef.current = false;
    }
    return result;
  };
  const regenerateCommentPrompt = async (renderOutro: boolean) => {
    const result = await run(async () => {
      // A prompt regeneration can immediately trigger an outro-only render.
      // Persist every other local brand field first so that render uses exactly
      // what the creator sees, never a stale polling snapshot.
      if (dirtyOutroFieldsRef.current.size > 0 || channelsDirtyRef.current) {
        await updateReelSettings(reelKey, {
          outroChannelId,
          outroInstagramChannelId,
          outro: compactOutroSettings(outro),
          skipPartOutro,
          skipBrandedOutro,
        });
        dirtyOutroFieldsRef.current.clear();
        channelsDirtyRef.current = false;
      }
      const next = await regenerateOutroCommentPrompt(reelKey);
      setOutro(next.outro ?? {});
      return renderOutro ? regenerateReel(reelKey, "outro_only") : next;
    });
    return result;
  };

  return (
    <div className="grid gap-2.5">
      <PanelTitle className="text-foreground">Outro</PanelTitle>
      <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
        {isPlanReview
          ? "Choose which end segments to include before generate. Free now — no TTS until approval."
          : "Optional end segments after the story body. Skipping either deletes its cached audio from S3; re-render to bake the change into the final video."}
      </p>

      <OutroIncludeToggles
        reel={reel}
        busy={busy}
        run={run}
        requestConfirm={requestConfirm}
      />

      {!isPlanReview ? <RenderCacheStatus reel={reel} intent="outro" /> : null}

      <div className={cn("grid gap-2.5", !brandedEnabled && "pointer-events-none opacity-50")}>
        <Label className="text-xs text-muted-foreground">
          Brand account
          <Select
            disabled={busy || !brandedEnabled}
            value={outroInstagramChannelId ? `instagram:${outroInstagramChannelId}` : outroChannelId}
            onChange={(event) => updateBrandAccount(event.target.value)}
          >
            <option value="">Auto by niche</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channelDisplayName(channel)} · {channelPurpose(channel)} · {channel.privacyStatus}
              </option>
            ))}
            {instagramChannels.map((channel) => (
              <option key={`instagram:${channel.id}`} value={`instagram:${channel.id}`}>
                Instagram · {channel.username ? `@${channel.username}` : channel.label}
              </option>
            ))}
          </Select>
        </Label>

        {selected ? (
          <div className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            The outro will use {channelDisplayName(selected)} unless you override the display name below.
          </div>
        ) : null}
        {selectedInstagram ? <div className="rounded-md border border-pink-500/20 bg-pink-500/[0.04] px-3 py-2 text-xs text-muted-foreground">The outro will use @{selectedInstagram.username ?? selectedInstagram.label}, including its Instagram profile image.</div> : null}

        <Label className="text-xs text-muted-foreground">
          Display name override
          <Input
            disabled={busy || !brandedEnabled}
            value={outro.channelName ?? ""}
            placeholder={selected ? channelDisplayName(selected) : "Auto channel name"}
            onChange={(event) => patchOutro({ channelName: event.target.value })}
          />
        </Label>

        <Label className="text-xs text-muted-foreground">
          Handle override
          <Input
            disabled={busy || !brandedEnabled}
            value={outro.channelHandle ?? ""}
            placeholder="@channel"
            onChange={(event) => patchOutro({ channelHandle: event.target.value })}
          />
        </Label>

        <Label className="text-xs text-muted-foreground">
          Comment prompt
          <span className="ml-1 font-normal text-muted-foreground/70">
            (on card + TTS; a new reel gets a story-specific AI question)
          </span>
          <Textarea
            rows={2}
            maxLength={160}
            disabled={busy || !brandedEnabled}
            value={outro.commentPrompt ?? ""}
            placeholder="AI-generated for this story part"
            onChange={(event) => patchOutro({ commentPrompt: event.target.value })}
          />
          <span className="mt-1 block text-right text-[10px] text-muted-foreground/70">
            {(outro.commentPrompt ?? "").length}/160
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || !brandedEnabled}
            className="mt-1.5"
            onClick={() => {
              const canFastRender = !isPlanReview && canOutroOnlyRerender(reel) && !skipPartOutro;
              requestConfirm({
                title: canFastRender
                  ? "Regenerate the question and outro?"
                  : "Regenerate the comment question?",
                body: canFastRender
                  ? "A cheap AI call creates a fresh question for this exact story part, then only affected branded outros are rebuilt from the cached body."
                  : "A cheap AI call creates a fresh question for this exact story part. No scene, gameplay, or narration assets are changed.",
                details: [
                  "The question is saved on the primary outro and inherited by extra channels that have no manual question.",
                  "The AI call is recorded in this reel's cost breakdown immediately.",
                  ...(dirtyOutroFieldsRef.current.size > 0 || channelsDirtyRef.current
                    ? ["Your unsaved brand fields are saved first, so the generated outro uses them too."]
                    : []),
                  canFastRender
                    ? "Ready sibling channels with their own prompt are left untouched; only the branded outro layer is rendered."
                    : isPlanReview
                      ? "This is copy-only during plan review; branded-outro TTS runs after you generate the reel."
                      : "Use Render outro after this if no cached body is available.",
                ],
                confirmLabel: canFastRender ? "Regenerate & render outro" : "Regenerate question · AI",
                costTone: "paid",
                onConfirm: () => regenerateCommentPrompt(canFastRender),
              });
            }}
          >
            <Sparkles size={14} /> {isPlanReview ? "Regenerate story question" : "Regenerate question"}
          </Button>
        </Label>

        <Label className="text-xs text-muted-foreground">
          Channel call to action
          <span className="ml-1 font-normal text-muted-foreground/70">
            {isPlanReview ? "(saved for generate)" : "(TTS if changed)"}
          </span>
          <Textarea
            rows={2}
            disabled={busy || !brandedEnabled}
            value={outro.spokenLine ?? ""}
            placeholder={defaultOutroSpokenLine(outroPlatform)}
            onChange={(event) => patchOutro({ spokenLine: event.target.value })}
          />
        </Label>

        <div className="grid gap-2 sm:grid-cols-2">
          <Label className="text-xs text-muted-foreground">
            Card title
            <span className="ml-1 font-normal text-muted-foreground/70">(visual)</span>
            <Input
              disabled={busy || !brandedEnabled}
              value={outro.title ?? ""}
              placeholder={reel.niche.startsWith("horror") ? "DON'T WATCH ALONE" : `${defaultCta} FOR MORE`}
              onChange={(event) => patchOutro({ title: event.target.value })}
            />
          </Label>
          <Label className="text-xs text-muted-foreground">
            Card subtitle
            <span className="ml-1 font-normal text-muted-foreground/70">(visual)</span>
            <Input
              disabled={busy || !brandedEnabled}
              value={outro.subtitle ?? ""}
              placeholder={
                reel.niche.startsWith("horror")
                  ? "New nightmares every night"
                  : "More stories after this one"
              }
              onChange={(event) => patchOutro({ subtitle: event.target.value })}
            />
          </Label>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Label className="text-xs text-muted-foreground">
            CTA button
            <span className="ml-1 font-normal text-muted-foreground/70">(blank uses {defaultCta})</span>
            <Input
              disabled={busy || !brandedEnabled}
              value={outro.cta ?? ""}
              placeholder={defaultCta}
              onChange={(event) => patchOutro({ cta: event.target.value })}
            />
          </Label>
          <Label className="text-xs text-muted-foreground">
            Footer
            <Input
              disabled={busy || !brandedEnabled}
              value={outro.footer ?? ""}
              placeholder={reel.niche.startsWith("horror") ? "it already knows you're here" : ""}
              onChange={(event) => patchOutro({ footer: event.target.value })}
            />
          </Label>
        </div>
      </div>

      {isPlanReview ? (
        <Button
          type="button"
          variant="outline"
          disabled={busy || !brandedEnabled}
          onClick={() => void saveBrandCopy()}
        >
          Save brand copy (free)
        </Button>
      ) : (
        <>
          <Button
            type="button"
            variant="default"
            disabled={busy}
            onClick={() => {
              const cost = describeRenderCost(reel, "outro");
              const outroOnly = canOutroOnlyRerender(reel) && !skipPartOutro;
              const skippingAll = skipBrandedOutro && (!showPartTeaser || skipPartOutro);
              requestConfirm({
                title: outroOnly
                  ? skipBrandedOutro
                    ? "Publish body without branded outro?"
                    : "Render outro only?"
                  : "Render outro draft?",
                body: cost.detail,
                details: outroOnly
                  ? skipBrandedOutro
                    ? [
                        "Cached body is re-uploaded as the final video (no branded outro).",
                        "No TTS spend for the channel end card.",
                      ]
                    : [
                        "Only the branded outro clip is regenerated.",
                        "Spoken line spends TTS only if that line or brand changed.",
                      ]
                  : gameplayRerenderCostsCredits(reel)
                    ? [
                        `About ${gameplayMissingTtsSegmentCount(reel)} narration segment(s) may be charged.`,
                        "This first bake also builds the body cache for later outro-only edits.",
                      ]
                    : [
                        "Scene stills and body narration are reused.",
                        "Body cache will be saved for cheaper outro edits next time.",
                      ],
                confirmLabel: outroOnly
                  ? skipBrandedOutro
                    ? "Publish body · free"
                    : "Render outro · free body"
                  : gameplayRerenderCostsCredits(reel)
                    ? `Spend credits (~${gameplayMissingTtsSegmentCount(reel)} TTS)`
                    : skippingAll
                      ? "Re-render without outros"
                      : "Render outro",
                costTone: cost.tone,
                onConfirm: async () => {
                  const saved = await saveBrandCopy();
                  if (!saved.ok) return saved;
                  return run(() => regenerateReel(reelKey, outroOnly ? "outro_only" : "render_only"));
                },
              });
            }}
          >
            <RefreshCw size={15} />{" "}
            {canOutroOnlyRerender(reel) && !skipPartOutro
              ? skipBrandedOutro
                ? "Publish body · no branded outro"
                : "Render outro · body cached"
              : gameplayRerenderCostsCredits(reel)
                ? `Render · ~${gameplayMissingTtsSegmentCount(reel)} TTS`
                : skipBrandedOutro && (!showPartTeaser || skipPartOutro)
                  ? "Re-render without outros"
                  : "Render outro draft"}
          </Button>
          <p className="text-[11px] text-muted-foreground/80">
            {canOutroOnlyRerender(reel) && !skipPartOutro
              ? skipBrandedOutro
                ? "Fast path: body video becomes the final output with no channel end card."
                : "Fast path: new outro clip concatenated onto the cached body video."
              : "Body cache missing or part teaser changed — this bake rebuilds the reel body once."}
          </p>
        </>
      )}
    </div>
  );
}
