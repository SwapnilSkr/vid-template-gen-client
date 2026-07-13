import { ChevronDown, Plus, RefreshCw, Trash2, Youtube } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  addReelDestination,
  listInstagramChannels,
  listYouTubeChannels,
  mediaUrl,
  removeReelDestination,
  updateReelDestinationOutro,
  type InstagramChannelOption,
  type OutroSettings,
  type Reel,
  type ReelDestination,
  type YouTubeChannelOption,
} from "@/api/reels";
import type { StudioRun } from "@/components/studio/types";
import { channelDisplayName, compactOutroSettings } from "@/components/studio/utils";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelTitle } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

type ChannelChoice = { key: string; platform: "youtube" | "instagram"; channelId: string; label: string };

const statusTone: Record<ReelDestination["status"], string> = {
  ready: "text-emerald-500",
  rendering: "text-amber-500",
  pending: "text-muted-foreground/70",
  failed: "text-destructive",
};

export function DestinationsPanel({
  reel,
  busy,
  run,
}: {
  reel: Reel;
  busy: boolean;
  run: StudioRun;
}) {
  const reelKey = reel._id ?? reel.id ?? "";
  const extras = useMemo(() => reel.destinations ?? [], [reel.destinations]);
  const [yt, setYt] = useState<YouTubeChannelOption[]>([]);
  const [ig, setIg] = useState<InstagramChannelOption[]>([]);
  const [addValue, setAddValue] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, OutroSettings>>({});

  useEffect(() => {
    void Promise.allSettled([listYouTubeChannels(), listInstagramChannels()]).then(([a, b]) => {
      setYt(a.status === "fulfilled" ? a.value : []);
      setIg(b.status === "fulfilled" ? b.value : []);
    });
  }, []);

  const primaryPlatform: "youtube" | "instagram" = reel.outroInstagramChannelId ? "instagram" : "youtube";
  const primaryChannelId = reel.outroInstagramChannelId || reel.outroChannelId || "";

  const usedKeys = useMemo(() => {
    const set = new Set<string>([`${primaryPlatform}:${primaryChannelId}`]);
    for (const dest of extras) set.add(`${dest.platform}:${dest.channelId}`);
    return set;
  }, [extras, primaryPlatform, primaryChannelId]);

  const options: ChannelChoice[] = useMemo(() => {
    const all: ChannelChoice[] = [
      ...yt.map((c) => ({ key: `youtube:${c.id}`, platform: "youtube" as const, channelId: c.id, label: channelDisplayName(c) })),
      ...ig.map((c) => ({ key: `instagram:${c.id}`, platform: "instagram" as const, channelId: c.id, label: `Instagram · ${c.username ? `@${c.username}` : c.label}` })),
    ];
    return all.filter((option) => !usedKeys.has(option.key));
  }, [yt, ig, usedKeys]);

  const draftFor = (dest: ReelDestination): OutroSettings => drafts[dest.id] ?? dest.outro ?? {};
  const patchDraft = (id: string, patch: Partial<OutroSettings>) =>
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? extras.find((d) => d.id === id)?.outro ?? {}), ...patch } }));

  const addChannel = () => {
    const choice = options.find((option) => option.key === addValue);
    if (!choice) return;
    void run(() => addReelDestination(reelKey, { platform: choice.platform, channelId: choice.channelId }));
    setAddValue("");
  };

  return (
    <div className="grid gap-2.5">
      <PanelTitle className="inline-flex items-center gap-2 text-foreground">
        <Youtube size={15} className="text-primary" /> Channels
      </PanelTitle>
      <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
        Publish this reel to multiple channels — each gets its own outro over the same body, so
        the only extra spend is that channel's outro voiceover. The primary channel's outro is set
        in the fields below; extra channels are managed here.
      </p>

      {/* Primary (read-only reference — edited in the Outro fields below) */}
      <div className="rounded-md border border-border bg-card px-3 py-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="min-w-0 truncate font-medium text-foreground">
            {primaryChannelId || "Auto by niche"}
            <span className="ml-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              Primary
            </span>
          </span>
          <span className={cn("shrink-0 text-[11px]", reel.outputUrl ? statusTone.ready : statusTone.pending)}>
            {reel.outputUrl ? "ready" : "not rendered"}
          </span>
        </div>
        {reel.outputUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            key={reel.outputUrl}
            src={mediaUrl(reel.outputUrl)}
            controls
            preload="none"
            className="mt-2 aspect-9/16 max-h-[38vh] w-full max-w-[220px] rounded-md border border-border bg-black"
          />
        ) : null}
      </div>

      {/* Extra channels */}
      {extras.map((dest) => {
        const isOpen = expanded === dest.id;
        const draft = draftFor(dest);
        return (
          <div key={dest.id} className="rounded-md border border-border bg-card">
            <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
              <span className="min-w-0 truncate font-medium text-foreground">
                {dest.channelLabel || dest.channelId}
                <span className="ml-1.5 text-muted-foreground/60">· {dest.platform}</span>
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <span className={cn("text-[11px]", statusTone[dest.status])}>{dest.status}</span>
                <button
                  type="button"
                  disabled={busy}
                  title="Remove channel"
                  aria-label={`Remove ${dest.channelLabel ?? dest.channelId}`}
                  onClick={() => void run(() => removeReelDestination(reelKey, dest.id))}
                  className="grid h-6 w-6 place-items-center rounded text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {dest.outputUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                key={dest.outputUrl}
                src={mediaUrl(dest.outputUrl)}
                controls
                preload="none"
                className="mx-3 aspect-9/16 max-h-[38vh] w-[calc(100%-1.5rem)] max-w-[220px] rounded-md border border-border bg-black"
              />
            ) : null}

            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : dest.id)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Edit this channel's outro
              <ChevronDown size={14} className={cn("transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen ? (
              <div className="grid gap-2 border-t border-border px-3 py-2.5">
                <Label className="text-xs text-muted-foreground">
                  Spoken outro line
                  <span className="ml-1 font-normal text-muted-foreground/70">(TTS if changed)</span>
                  <Textarea
                    rows={2}
                    disabled={busy}
                    value={draft.spokenLine ?? ""}
                    placeholder={`Follow ${dest.channelLabel ?? "this channel"} for more stories.`}
                    onChange={(event) => patchDraft(dest.id, { spokenLine: event.target.value })}
                  />
                </Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Label className="text-xs text-muted-foreground">
                    Display name
                    <Input
                      disabled={busy}
                      value={draft.channelName ?? ""}
                      placeholder={dest.channelLabel ?? "Channel name"}
                      onChange={(event) => patchDraft(dest.id, { channelName: event.target.value })}
                    />
                  </Label>
                  <Label className="text-xs text-muted-foreground">
                    Handle
                    <Input
                      disabled={busy}
                      value={draft.channelHandle ?? ""}
                      placeholder="@channel"
                      onChange={(event) => patchDraft(dest.id, { channelHandle: event.target.value })}
                    />
                  </Label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Label className="text-xs text-muted-foreground">
                    Card title
                    <Input
                      disabled={busy}
                      value={draft.title ?? ""}
                      placeholder="FOLLOW FOR MORE"
                      onChange={(event) => patchDraft(dest.id, { title: event.target.value })}
                    />
                  </Label>
                  <Label className="text-xs text-muted-foreground">
                    Card subtitle
                    <Input
                      disabled={busy}
                      value={draft.subtitle ?? ""}
                      placeholder="More stories after this one"
                      onChange={(event) => patchDraft(dest.id, { subtitle: event.target.value })}
                    />
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="default"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const next = await updateReelDestinationOutro(
                        reelKey,
                        dest.id,
                        compactOutroSettings(draft),
                      );
                      setDrafts((current) => {
                        const { [dest.id]: _removed, ...rest } = current;
                        return rest;
                      });
                      return next;
                    })
                  }
                >
                  <RefreshCw size={14} /> Save &amp; re-render this outro
                </Button>
              </div>
            ) : null}
          </div>
        );
      })}

      {/* Add a channel */}
      <div className="grid gap-2 rounded-md border border-dashed border-border px-3 py-2.5">
        <span className="text-[11px] font-medium text-muted-foreground">Add a channel</span>
        {options.length === 0 ? (
          <p className="m-0 text-[11px] text-muted-foreground/70">
            No more connected channels available to add.
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <Select
              disabled={busy}
              value={addValue}
              onChange={(event) => setAddValue(event.target.value)}
              className="min-w-0 flex-1"
            >
              <option value="">Choose a channel…</option>
              {options.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Button type="button" variant="outline" disabled={busy || !addValue} onClick={addChannel}>
              <Plus size={14} /> Add
            </Button>
          </div>
        )}
        <p className="m-0 text-[11px] text-muted-foreground/70">
          Once produced, adding a channel renders just its outro (reused body — only its voiceover
          is charged).
        </p>
      </div>
    </div>
  );
}
