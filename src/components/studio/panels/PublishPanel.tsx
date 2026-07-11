import { ExternalLink, Loader2, Send, Youtube } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getReel,
  listYouTubeChannels,
  publishReel,
  type Reel,
  type YouTubeChannelOption,
} from "@/api/reels";
import type { ConfirmAction, StudioRun } from "@/components/studio/types";
import {
  channelDisplayName,
  channelPurpose,
} from "@/components/studio/utils";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelTitle } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

export function PublishPanel({
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
  const [channelId, setChannelId] = useState("");

  useEffect(() => {
    void listYouTubeChannels()
      .then(setChannels)
      .catch(() => setChannels([]));
  }, []);

  if (reel.status !== "completed") return null;
  const yt = reel.youtube;
  const selected = channels.find((channel) => channel.id === channelId);

  return (
    <div className="grid gap-2">
      <PanelTitle className="inline-flex items-center gap-2 text-foreground">
        <Youtube size={15} className="text-primary" /> Publish
      </PanelTitle>

      {yt ? (
        <div
          className={cn(
            "rounded-md border px-2.5 py-2 text-xs",
            yt.status === "published"
              ? "border-success/40 bg-success/10 text-success"
              : yt.status === "failed"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-warning/40 bg-warning/10 text-warning",
          )}
        >
          <span className="font-medium capitalize">{yt.status}</span>
          {yt.channelLabel ? ` · ${yt.channelLabel}` : ""}
          {yt.url ? (
            <a href={yt.url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-primary">
              Watch <ExternalLink size={11} />
            </a>
          ) : null}
          {yt.thumbnailStatus ? (
            <div className="mt-1 text-[11px] opacity-90">
              Thumbnail:{" "}
              {yt.thumbnailStatus === "uploaded"
                ? "custom image uploaded"
                : yt.thumbnailStatus === "failed"
                  ? "not uploaded"
                  : yt.thumbnailStatus === "missing"
                    ? "no thumbnail on reel"
                    : yt.thumbnailStatus}
            </div>
          ) : null}
          {yt.shortsCoverStatus ? (
            <div className="mt-0.5 text-[11px] opacity-90">
              Shorts cover:{" "}
              {yt.shortsCoverStatus === "applied"
                ? "vertical shelf image updated"
                : yt.shortsCoverStatus === "unchanged"
                  ? "still an auto video frame — set cover in YouTube Studio"
                  : "could not verify yet"}
            </div>
          ) : null}
          {yt.shortsCoverStatus === "unchanged" ? (
            <div className="mt-0.5 text-[11px] opacity-90">
              YouTube Shorts often keeps a separate auto cover even when the API
              accepts a custom thumb. In YouTube Studio → Content → the Short →
              Details, pick a frame/cover manually if the shelf still looks wrong.
            </div>
          ) : null}
          {yt.thumbnailError ? (
            <div className="mt-0.5 text-[11px] opacity-90">{yt.thumbnailError}</div>
          ) : null}
          {yt.error ? <div className="mt-1 text-[11px] opacity-90">{yt.error}</div> : null}
        </div>
      ) : null}

      <Label className="text-xs text-muted-foreground">
        Channel
        <Select disabled={busy} value={channelId} onChange={(e) => setChannelId(e.target.value)}>
          <option value="">Auto by niche</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.googleChannelTitle || channel.label} · {channel.privacyStatus}
            </option>
          ))}
        </Select>
      </Label>

      <Button
        type="button"
        variant="default"
        disabled={busy || !reel.outputUrl}
        onClick={() =>
          requestConfirm({
            title: yt?.status === "published" ? "Publish again?" : "Publish to YouTube?",
            body: `Uploads the rendered video${selected ? ` to ${selected.googleChannelTitle || selected.label}` : " to the niche's default channel"} with the reviewed title, description, tags, and thumbnail.`,
            details: [
              "Uses the review package (edit it on the Review screen first if needed).",
              "The upload runs in the background — status appears above.",
            ],
            confirmLabel: "Publish",
            onConfirm: () =>
              run(async () => {
                await publishReel(reelKey, channelId || undefined);
                return getReel(reelKey);
              }),
          })
        }
      >
        <Send size={15} /> {yt?.status === "published" ? "Republish" : "Publish to YouTube"}
      </Button>
    </div>
  );
}

// ---- Cinematic edit effects (rain / grain / vignette / letterbox) ----

