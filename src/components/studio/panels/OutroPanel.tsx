import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import {
  listYouTubeChannels,
  regenerateReel,
  updateReelSettings,
  type OutroSettings,
  type Reel,
  type YouTubeChannelOption,
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
  const [outroChannelId, setOutroChannelId] = useState(reel.outroChannelId ?? "");
  const [outro, setOutro] = useState<OutroSettings>(reel.outro ?? {});

  useEffect(() => {
    void listYouTubeChannels()
      .then(setChannels)
      .catch(() => setChannels([]));
  }, []);

  useEffect(() => {
    setOutroChannelId(reel.outroChannelId ?? "");
    setOutro(reel.outro ?? {});
  }, [reel.outro, reel.outroChannelId]);

  const selected = channels.find((channel) => channel.id === outroChannelId);
  const patchOutro = (patch: Partial<OutroSettings>) =>
    setOutro((current) => ({ ...current, ...patch }));
  const showPartTeaser = hasPartTeaser(reel);
  const skipPartOutro = Boolean(reel.skipPartOutro);
  const skipBrandedOutro = Boolean(reel.skipBrandedOutro);
  const brandedEnabled = !skipBrandedOutro;

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
          Brand channel
          <Select
            disabled={busy || !brandedEnabled}
            value={outroChannelId}
            onChange={(event) => setOutroChannelId(event.target.value)}
          >
            <option value="">Auto by niche</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channelDisplayName(channel)} · {channelPurpose(channel)} · {channel.privacyStatus}
              </option>
            ))}
          </Select>
        </Label>

        {selected ? (
          <div className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            The outro will use {channelDisplayName(selected)} unless you override the display name below.
          </div>
        ) : null}

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
          Spoken outro line
          <span className="ml-1 font-normal text-muted-foreground/70">
            {isPlanReview ? "(saved for generate)" : "(TTS if changed)"}
          </span>
          <Textarea
            rows={2}
            disabled={busy || !brandedEnabled}
            value={outro.spokenLine ?? ""}
            placeholder={
              reel.niche === "reddit"
                ? "Follow Channel Name for more stories."
                : "Subscribe to Channel Name. The next story is already waiting."
            }
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
              placeholder={reel.niche.startsWith("horror") ? "DON'T WATCH ALONE" : "FOLLOW FOR MORE"}
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
            <Input
              disabled={busy || !brandedEnabled}
              value={outro.cta ?? ""}
              placeholder="SUBSCRIBE"
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
          onClick={() =>
            void run(() =>
              updateReelSettings(reelKey, {
                outroChannelId,
                outro: compactOutroSettings(outro),
                skipPartOutro,
                skipBrandedOutro,
              })
            )
          }
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
                onConfirm: () =>
                  run(async () => {
                    await updateReelSettings(reelKey, {
                      outroChannelId,
                      outro: compactOutroSettings(outro),
                      skipPartOutro,
                      skipBrandedOutro,
                    });
                    return regenerateReel(reelKey, outroOnly ? "outro_only" : "render_only");
                  }),
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
