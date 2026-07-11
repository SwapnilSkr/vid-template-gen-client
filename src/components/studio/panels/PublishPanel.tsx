import { Check, ExternalLink, Hash, Send, X, Youtube } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getReel,
  listYouTubeChannels,
  publishReel,
  updateReview,
  type Reel,
  type YouTubeChannelOption,
} from "@/api/reels";
import { getTrendSummary, type TrendGenreSummary } from "@/api/trends";
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
  const [title, setTitle] = useState(reel.review?.title ?? reel.title ?? "");
  const [description, setDescription] = useState(reel.review?.description ?? "");
  const [tagsText, setTagsText] = useState((reel.review?.tags ?? []).join(", "));
  const [hashtags, setHashtags] = useState<string[]>(() => hashtagsFromDescription(reel.review?.description ?? ""));
  const [hashtagInput, setHashtagInput] = useState("");
  const [trendSummary, setTrendSummary] = useState<TrendGenreSummary | undefined>();

  useEffect(() => {
    void listYouTubeChannels()
      .then(setChannels)
      .catch(() => setChannels([]));
  }, []);

  useEffect(() => {
    void getTrendSummary("week", reel.niche)
      .then((items) => setTrendSummary(items.find((item) => item.genre === reel.genre) ?? items[0]))
      .catch(() => setTrendSummary(undefined));
  }, [reel.genre, reel.niche]);

  const observedHashtags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of trendSummary?.topPerformers ?? []) {
      for (const tag of hashtagsFromDescription(item.title ?? "")) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag]) => tag);
  }, [trendSummary]);
  const evergreenHashtags = useMemo(
    () => relevantHashtags(reel.niche, reel.genre).filter((tag) => !observedHashtags.includes(tag)),
    [observedHashtags, reel.genre, reel.niche],
  );

  const addHashtag = (raw: string) => {
    const tag = normalizeHashtag(raw);
    if (!tag || hashtags.includes(tag) || hashtags.length >= 15) return;
    setHashtags((current) => [...current, tag]);
    setHashtagInput("");
  };

  const saveMetadata = () => run(async () => {
    await updateReview(reelKey, {
      title: title.trim(),
      description: withManagedHashtags(description, hashtags),
      tags: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
    });
    return getReel(reelKey);
  });

  if (reel.status !== "completed") return null;
  const yt = reel.youtube;
  const selected = channels.find((channel) => channel.id === channelId);

  return (
    <div className="grid gap-2">
      <PanelTitle className="inline-flex items-center gap-2 text-foreground">
        <Youtube size={15} className="text-primary" /> Publish
      </PanelTitle>

      <div className="grid gap-2.5 rounded-md border border-border bg-background/35 p-2.5">
        <Label className="text-xs text-muted-foreground">
          YouTube title
          <Input value={title} maxLength={100} disabled={busy} onChange={(event) => setTitle(event.target.value)} />
          <span className={cn("justify-self-end text-[11px]", title.length > 90 ? "text-warning" : "text-muted-foreground/80")}>{title.length}/100</span>
        </Label>
        <Label className="text-xs text-muted-foreground">
          Description
          <Textarea value={description} maxLength={5000} rows={7} disabled={busy} onChange={(event) => setDescription(event.target.value)} />
          <span className={cn("justify-self-end text-[11px]", description.length > 4800 ? "text-warning" : "text-muted-foreground/80")}>{withManagedHashtags(description, hashtags).length}/5,000 including hashtags</span>
        </Label>

        <div className="grid gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><Hash size={12} /> Hashtags in description · {hashtags.length}/15 recommended cap</span>
          <div className="flex flex-wrap gap-1.5">
            {hashtags.map((tag) => (
              <button key={tag} type="button" disabled={busy} onClick={() => setHashtags((current) => current.filter((item) => item !== tag))} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] text-primary">
                {tag} <X size={10} />
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Input value={hashtagInput} disabled={busy || hashtags.length >= 15} placeholder="#RedditStories" onChange={(event) => setHashtagInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addHashtag(hashtagInput); } }} />
            <Button type="button" variant="outline" disabled={busy || !normalizeHashtag(hashtagInput)} onClick={() => addHashtag(hashtagInput)}>Add</Button>
          </div>
          {observedHashtags.length ? <HashtagSuggestions label="Observed in this week's references" tags={observedHashtags} selected={hashtags} onAdd={addHashtag} /> : null}
          <HashtagSuggestions label="Relevant suggestions" tags={evergreenHashtags} selected={hashtags} onAdd={addHashtag} />
          <p className="m-0 text-[11px] leading-relaxed text-muted-foreground/80">YouTube ignores all hashtags above 60. This editor intentionally caps the managed set at 15 and keeps them out of the title.</p>
        </div>

        <Label className="text-xs text-muted-foreground">
          Upload tags (comma-separated, optional)
          <Input value={tagsText} disabled={busy} onChange={(event) => setTagsText(event.target.value)} placeholder="shorts, reddit stories, aita" />
          <span className={cn("justify-self-end text-[11px]", tagsText.length > 500 ? "text-destructive" : "text-muted-foreground/80")}>{tagsText.length}/500</span>
        </Label>
        <Button type="button" variant="outline" disabled={busy || !title.trim() || title.length > 100 || withManagedHashtags(description, hashtags).length > 5000 || tagsText.length > 500} onClick={() => void saveMetadata()}>
          <Check size={14} /> Save publishing details
        </Button>
      </div>

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
              "Uses the publishing details shown in this Studio panel.",
              "The upload runs in the background — status appears above.",
            ],
            confirmLabel: "Publish",
            onConfirm: () =>
              run(async () => {
                await updateReview(reelKey, {
                  title: title.trim(),
                  description: withManagedHashtags(description, hashtags),
                  tags: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
                });
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

function normalizeHashtag(value: string): string {
  const clean = value.trim().replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "");
  return clean ? `#${clean}` : "";
}

function hashtagsFromDescription(value: string): string[] {
  return [...new Set((value.match(/#[\p{L}\p{N}_]+/gu) ?? []).map(normalizeHashtag).filter(Boolean))];
}

function withManagedHashtags(description: string, hashtags: string[]): string {
  const managed = hashtags.length ? hashtags.join(" ") : "";
  const lines = description.trimEnd().split("\n");
  if (lines.length && /^(?:\s*#[\p{L}\p{N}_]+\s*)+$/u.test(lines[lines.length - 1] ?? "")) lines.pop();
  const body = lines.join("\n").trimEnd();
  return managed ? `${body}${body ? "\n\n" : ""}${managed}` : body;
}

function relevantHashtags(niche: string, genre?: string): string[] {
  const common = ["#Shorts", "#YouTubeShorts", "#Storytime"];
  const nicheTags = niche === "reddit" ? ["#RedditStories", "#RedditShorts", "#AITA"] : niche.startsWith("horror") ? ["#HorrorShorts", "#ScaryStories", "#HorrorStory"] : [];
  const genreTag = genre ? normalizeHashtag(genre.replace(/_/g, "")) : "";
  return [...new Set([...nicheTags, ...(genreTag ? [genreTag] : []), ...common])];
}

function HashtagSuggestions({ label, tags, selected, onAdd }: { label: string; tags: string[]; selected: string[]; onAdd: (tag: string) => void }) {
  const available = tags.filter((tag) => !selected.includes(tag));
  if (!available.length) return null;
  return <div className="grid gap-1"><span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">{label}</span><div className="flex flex-wrap gap-1">{available.map((tag) => <button key={tag} type="button" onClick={() => onAdd(tag)} className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground">+ {tag}</button>)}</div></div>;
}

// ---- Cinematic edit effects (rain / grain / vignette / letterbox) ----
