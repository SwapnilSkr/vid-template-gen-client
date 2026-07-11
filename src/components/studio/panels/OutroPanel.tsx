import { Loader2, RefreshCw, Youtube } from "lucide-react";
import { useEffect, useState } from "react";
import {
  listYouTubeChannels,
  regenerateReel,
  updateReelSettings,
  type OutroSettings,
  type Reel,
  type YouTubeChannelOption,
} from "@/api/reels";
import { CostChip, RenderCacheStatus, describeRenderCost } from "@/components/reels/RenderCostHint";
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

  return (
    <div className="grid gap-2.5">
      <PanelTitle className="text-foreground">Outro</PanelTitle>
      <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
        Branded end card appended after the reel body. When the body is cached,
        only this outro is rebuilt.
      </p>
      <RenderCacheStatus reel={reel} intent="outro" />

      <Label className="text-xs text-muted-foreground">
        Brand channel
        <Select
          disabled={busy}
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
          disabled={busy}
          value={outro.channelName ?? ""}
          placeholder={selected ? channelDisplayName(selected) : "Auto channel name"}
          onChange={(event) => patchOutro({ channelName: event.target.value })}
        />
      </Label>

      <Label className="text-xs text-muted-foreground">
        Handle override
        <Input
          disabled={busy}
          value={outro.channelHandle ?? ""}
          placeholder="@channel"
          onChange={(event) => patchOutro({ channelHandle: event.target.value })}
        />
      </Label>

      <Label className="text-xs text-muted-foreground">
        Spoken outro line
        <span className="ml-1 font-normal text-muted-foreground/70">(TTS if changed)</span>
        <Textarea
          rows={2}
          disabled={busy}
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
            disabled={busy}
            value={outro.title ?? ""}
            placeholder={reel.niche.startsWith("horror") ? "DON'T WATCH ALONE" : "FOLLOW FOR MORE"}
            onChange={(event) => patchOutro({ title: event.target.value })}
          />
        </Label>
        <Label className="text-xs text-muted-foreground">
          Card subtitle
          <span className="ml-1 font-normal text-muted-foreground/70">(visual)</span>
          <Input
            disabled={busy}
            value={outro.subtitle ?? ""}
            placeholder={reel.niche.startsWith("horror") ? "New nightmares every night" : "More stories after this one"}
            onChange={(event) => patchOutro({ subtitle: event.target.value })}
          />
        </Label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Label className="text-xs text-muted-foreground">
          CTA button
          <Input
            disabled={busy}
            value={outro.cta ?? ""}
            placeholder="SUBSCRIBE"
            onChange={(event) => patchOutro({ cta: event.target.value })}
          />
        </Label>
        <Label className="text-xs text-muted-foreground">
          Footer
          <Input
            disabled={busy}
            value={outro.footer ?? ""}
            placeholder={reel.niche.startsWith("horror") ? "it already knows you're here" : ""}
            onChange={(event) => patchOutro({ footer: event.target.value })}
          />
        </Label>
      </div>

      <Button
        type="button"
        variant="default"
        disabled={busy}
        onClick={() => {
          const cost = describeRenderCost(reel, "outro");
          requestConfirm({
            title: canOutroOnlyRerender(reel) ? "Render outro only?" : "Render outro draft?",
            body: cost.detail,
            details: canOutroOnlyRerender(reel)
              ? [
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
            confirmLabel: canOutroOnlyRerender(reel)
              ? "Render outro · free body"
              : gameplayRerenderCostsCredits(reel)
                ? `Spend credits (~${gameplayMissingTtsSegmentCount(reel)} TTS)`
                : "Render outro",
            costTone: cost.tone,
            onConfirm: () =>
              run(async () => {
                await updateReelSettings(reelKey, {
                  outroChannelId,
                  outro: compactOutroSettings(outro),
                });
                return regenerateReel(
                  reelKey,
                  canOutroOnlyRerender(reel) ? "outro_only" : "render_only"
                );
              }),
          });
        }}
      >
        <RefreshCw size={15} />{" "}
        {canOutroOnlyRerender(reel)
          ? "Render outro · body cached"
          : gameplayRerenderCostsCredits(reel)
            ? `Render outro · ~${gameplayMissingTtsSegmentCount(reel)} TTS`
            : "Render outro draft"}
      </Button>
      <p className="text-[11px] text-muted-foreground/80">
        {canOutroOnlyRerender(reel)
          ? "Fast path: new outro clip concatenated onto the cached body video."
          : "Body cache missing — this bake rebuilds the reel once, then outro edits stay cheap."}
      </p>
    </div>
  );
}

