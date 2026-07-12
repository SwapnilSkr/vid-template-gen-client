import { Check, ExternalLink, Hash, Instagram, Send, X, Youtube } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  getReel,
  distributeReel,
  listInstagramChannels,
  listYouTubeChannels,
  updateReview,
  updateReelSettings,
  type Reel,
  type YouTubeChannelOption,
  type InstagramChannelOption,
} from "@/api/reels";
import { getTrendSummary, type TrendGenreSummary } from "@/api/trends";
import type { ConfirmAction, StudioRun } from "@/components/studio/types";
import {
  channelDisplayName,
  channelPurpose,
} from "@/components/studio/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelTitle } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import {
  countHashtags,
  extractHashtags,
  normalizeHashtag,
  relevantHashtags,
} from "@/utils/youtube-hashtags";

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
  const [instagramChannels, setInstagramChannels] = useState<InstagramChannelOption[]>([]);
  const [selectedYoutubeIds, setSelectedYoutubeIds] = useState<string[]>([]);
  const [selectedInstagramIds, setSelectedInstagramIds] = useState<string[]>([]);
  const [title, setTitle] = useState(() => reel.review?.title ?? reel.title ?? "");
  const [description, setDescription] = useState(() => reel.review?.description ?? "");
  const [tagsText, setTagsText] = useState((reel.review?.tags ?? []).join(", "));
  const [instagramCaption, setInstagramCaption] = useState(() => reel.instagramSettings?.caption ?? reel.review?.description ?? "");
  const [shareToFeed, setShareToFeed] = useState(() => reel.instagramSettings?.shareToFeed ?? true);
  const [hashtagInput, setHashtagInput] = useState("");
  const [hashtagTarget, setHashtagTarget] = useState<"title" | "description">("description");
  const [trendSummary, setTrendSummary] = useState<TrendGenreSummary | undefined>();

  useEffect(() => {
    void Promise.allSettled([listYouTubeChannels(), listInstagramChannels()]).then(([yt, ig]) => {
      setChannels(yt.status === "fulfilled" ? yt.value : []);
      setInstagramChannels(ig.status === "fulfilled" ? ig.value : []);
    });
  }, []);

  useEffect(() => {
    void getTrendSummary("week", reel.niche)
      .then((items) => setTrendSummary(items.find((item) => item.genre === reel.genre) ?? items[0]))
      .catch(() => setTrendSummary(undefined));
  }, [reel.genre, reel.niche]);

  const observedHashtags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of trendSummary?.topPerformers ?? []) {
      for (const tag of extractHashtags(`${item.title ?? ""} ${item.description ?? ""}`)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag]) => tag);
  }, [trendSummary]);
  const evergreenHashtags = useMemo(
    () => relevantHashtags(reel.niche, reel.genre).filter((tag) => !observedHashtags.includes(tag)),
    [observedHashtags, reel.genre, reel.niche],
  );
  const hashtags = useMemo(() => [...new Set([...extractHashtags(title), ...extractHashtags(description)])], [description, title]);
  const titleHashtags = useMemo(() => extractHashtags(title), [title]);
  const descriptionHashtags = useMemo(() => extractHashtags(description), [description]);
  const totalHashtagCount = useMemo(
    () => countHashtags(title, description),
    [description, title],
  );

  const addHashtag = (raw: string, target = hashtagTarget) => {
    const tag = normalizeHashtag(raw);
    if (!tag || hashtags.includes(tag) || hashtags.length >= 15) return;
    if (target === "title") setTitle((current) => `${current.trimEnd()}${current.trim() ? " " : ""}${tag}`);
    else setDescription((current) => `${current.trimEnd()}${current.trim() ? "\n\n" : ""}${tag}`);
    setHashtagInput("");
  };
  const removeHashtag = (tag: string) => {
    const pattern = new RegExp(`(^|\\s)${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`, "g");
    setTitle((current) => current.replace(pattern, "$1").replace(/\s{2,}/g, " ").trim());
    setDescription((current) => current.replace(pattern, "$1").replace(/[ \t]{2,}/g, " ").trim());
  };

  const saveMetadata = () => run(async () => {
    await updateReview(reelKey, {
      title,
      description,
      tags: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
    });
    return getReel(reelKey);
  });
  const saveInstagramMetadata = () => run(async () => updateReelSettings(reelKey, { instagram: { caption: instagramCaption, shareToFeed } }));

  if (reel.status !== "completed") return null;
  const yt = reel.youtube;
  const targetCount = selectedYoutubeIds.length + selectedInstagramIds.length;
  const instagramPublishByChannel = new Map((reel.instagram ?? []).map((publish) => [publish.channelId, publish]));
  const activeInstagram = (reel.instagram ?? []).filter((publish) => publish.status === "pending" || publish.status === "uploading");
  const republishingInstagram = selectedInstagramIds.filter((id) => instagramPublishByChannel.get(id)?.status === "published");
  const toggle = (id: string, setIds: React.Dispatch<React.SetStateAction<string[]>>) => setIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);

  return (
    <div className="grid gap-2">
      <PanelTitle className="inline-flex items-center gap-2 text-foreground">
        <Send size={15} className="text-primary" /> Distribution
      </PanelTitle>

      <div className="grid gap-2.5 rounded-md border border-border bg-background/35 p-2.5">
        <Label className="text-xs text-muted-foreground">
          YouTube title
          <Input value={title} disabled={busy} onChange={(event) => setTitle(event.target.value)} />
          <span className={cn("justify-self-end text-[11px]", title.length > 90 ? "text-warning" : "text-muted-foreground/80")}>
            {title.length}/100 · {titleHashtags.length} hashtag{titleHashtags.length === 1 ? "" : "s"}
          </span>
          <span className="text-[11px] text-muted-foreground/80">Type hashtags directly here; this is the exact title YouTube receives.</span>
        </Label>
        <Label className="text-xs text-muted-foreground">
          Description
          <Textarea value={description} maxLength={5000} rows={7} disabled={busy} onChange={(event) => setDescription(event.target.value)} />
          <span className={cn("justify-self-end text-[11px]", description.length > 4800 ? "text-warning" : "text-muted-foreground/80")}>
            {description.length}/5,000 · {descriptionHashtags.length} hashtag{descriptionHashtags.length === 1 ? "" : "s"}
          </span>
          <span className="text-[11px] text-muted-foreground/80">This same copy becomes the Instagram Reel caption for selected Instagram accounts.</span>
        </Label>

        <div className="grid gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Hash size={12} /> Hashtags · {hashtags.length}/15 recommended cap
          </span>
          <div className="flex flex-wrap gap-1.5">
            {hashtags.map((tag) => (
              <button key={tag} type="button" disabled={busy} onClick={() => removeHashtag(tag)} title="Remove from title or description" className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] text-primary">
                {tag} <X size={10} />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Input value={hashtagInput} disabled={busy || hashtags.length >= 15} placeholder="#RedditStories" onChange={(event) => setHashtagInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addHashtag(hashtagInput); } }} />
            <div className="inline-flex rounded-md border border-border p-0.5"><button type="button" onClick={() => setHashtagTarget("title")} className={cn("rounded px-2 py-1 text-[11px]", hashtagTarget === "title" ? "bg-accent text-foreground" : "text-muted-foreground")}>Title</button><button type="button" onClick={() => setHashtagTarget("description")} className={cn("rounded px-2 py-1 text-[11px]", hashtagTarget === "description" ? "bg-accent text-foreground" : "text-muted-foreground")}>Description</button></div>
            <Button type="button" variant="outline" disabled={busy || !normalizeHashtag(hashtagInput)} onClick={() => addHashtag(hashtagInput)}>Add</Button>
          </div>
          {observedHashtags.length ? <HashtagSuggestions label="Observed in this week's references" tags={observedHashtags} selected={hashtags} onAdd={addHashtag} /> : null}
          <HashtagSuggestions label="Relevant suggestions" tags={evergreenHashtags} selected={hashtags} onAdd={addHashtag} />
          <p className="m-0 text-[11px] leading-relaxed text-muted-foreground/80">
            Suggestions insert into the selected field. You can also type, move, or delete hashtags directly in Title and Description.
            YouTube ignores all hashtags when a video has more than 60 total — currently {totalHashtagCount}/60.
          </p>
        </div>

        <Label className="text-xs text-muted-foreground">
          Upload tags (comma-separated, optional)
          <Input value={tagsText} disabled={busy} onChange={(event) => setTagsText(event.target.value)} placeholder="shorts, reddit stories, aita" />
          <span className={cn("justify-self-end text-[11px]", tagsText.length > 500 ? "text-destructive" : "text-muted-foreground/80")}>{tagsText.length}/500</span>
        </Label>
        <Button
          type="button"
          variant="outline"
          disabled={
            busy
            || !title.trim()
            || title.length > 100
            || description.length > 5000
            || tagsText.length > 500
            || totalHashtagCount > 60
          }
          onClick={() => void saveMetadata()}
        >
          <Check size={14} /> Save publishing details
        </Button>
        <div className="rounded border border-border bg-card/60 p-2.5 text-xs"><div className="mb-1 inline-flex items-center gap-1 font-medium"><Youtube size={12} className="text-red-500" />YouTube Shorts preview</div><p className="m-0 font-semibold text-foreground">{title || "Your YouTube title"}</p><p className="mb-0 mt-1 whitespace-pre-wrap text-muted-foreground">{description || "Your YouTube description"}</p><p className="mb-0 mt-2 text-[11px] text-muted-foreground">Thumbnail: {reel.review?.thumbnailUrl ? "YouTube thumbnail ready." : "No uploaded thumbnail yet."}</p></div>
      </div>

      <div className="grid gap-2.5 rounded-md border border-pink-500/20 bg-pink-500/[0.035] p-2.5">
        <div className="flex items-center justify-between"><span className="inline-flex items-center gap-2 text-sm font-semibold"><Instagram size={15} className="text-pink-500" />Instagram Reel</span><span className="text-[11px] text-muted-foreground">Platform-specific</span></div>
        <Label className="text-xs text-muted-foreground">Caption<Textarea value={instagramCaption} maxLength={2200} rows={5} disabled={busy} placeholder="Write the Reel caption, hook, CTA, and hashtags…" onChange={(event) => setInstagramCaption(event.target.value)} /><span className={cn("justify-self-end text-[11px]", instagramCaption.length > 2100 ? "text-warning" : "text-muted-foreground/80")}>{instagramCaption.length}/2,200 · {extractHashtags(instagramCaption).length} hashtags</span></Label>
        <label className="flex cursor-pointer items-center gap-2 rounded border border-border bg-card/60 px-2.5 py-2 text-xs"><input type="checkbox" checked={shareToFeed} disabled={busy} onChange={(event) => setShareToFeed(event.target.checked)} /><span className="font-medium">Also share to Feed</span><span className="ml-auto text-muted-foreground">{shareToFeed ? "Reels + Feed" : "Reels tab only"}</span></label>
        <div className="rounded border border-border bg-card/60 p-2.5 text-xs"><div className="mb-1 inline-flex items-center gap-1 font-medium"><Instagram size={12} />Reel preview</div><p className="m-0 whitespace-pre-wrap text-muted-foreground">{instagramCaption || "Your Instagram caption will appear here."}</p><p className="mb-0 mt-2 text-[11px] text-muted-foreground">Cover: {reel.shortsCover?.imageUrl ? "Instagram selects the first frame from the rendered MP4. Re-render after saving the Vertical Cover so it is baked into that opening frame." : "Instagram will use the first video frame. Create a Vertical Cover, then re-render for a controlled result."}</p></div>
        <Button type="button" variant="outline" disabled={busy || instagramCaption.length > 2200} onClick={() => void saveInstagramMetadata()}><Check size={14} />Save Instagram details</Button>
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

      <div className="grid gap-2 rounded-md border border-border bg-background/35 p-2.5">
        <div className="text-xs font-semibold text-foreground">Publish destinations</div>
        <p className="text-[11px] text-muted-foreground">Select every owned account that should receive this reviewed render. Each upload runs independently.</p>
        {channels.length ? <DestinationGroup icon={<Youtube size={14} className="text-red-500" />} title="YouTube Shorts">{channels.map((channel) => <DestinationOption key={channel.id} checked={selectedYoutubeIds.includes(channel.id)} disabled={busy} onChange={() => toggle(channel.id, setSelectedYoutubeIds)} label={channel.googleChannelTitle || channel.label} detail={`${channel.googleChannelHandle || channel.privacyStatus} · ${channel.privacyStatus}`} />)}</DestinationGroup> : null}
        {instagramChannels.length ? <DestinationGroup icon={<Instagram size={14} className="text-pink-500" />} title="Instagram Reels">{instagramChannels.map((channel) => { const publish = instagramPublishByChannel.get(channel.id); const active = publish?.status === "pending" || publish?.status === "uploading"; return <DestinationOption key={channel.id} checked={selectedInstagramIds.includes(channel.id)} disabled={busy || channel.status !== "active" || active} onChange={() => toggle(channel.id, setSelectedInstagramIds)} label={channel.username ? `@${channel.username}` : channel.label} detail={active ? `${publish?.status} · ${publish?.message ?? "working"}` : publish?.status === "published" ? "published · select to republish" : channel.label} />; })}</DestinationGroup> : null}
        {!channels.length && !instagramChannels.length ? <div className="text-xs text-warning">Connect an account from Accounts before publishing.</div> : null}
      </div>
      {reel.instagram?.length ? <div className="grid gap-1">{reel.instagram.map((publish) => <PublishOutcome key={publish.channelId} label={publish.channelLabel || publish.channelId} status={publish.status} url={publish.url} error={publish.error} message={publish.message} icon={<Instagram size={12} />} />)}</div> : null}
      {activeInstagram.length ? <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary"><strong>Publishing in progress.</strong> {activeInstagram.map((publish) => `${publish.channelLabel ?? publish.channelId}: ${publish.message ?? publish.status}`).join(" · ")} The Studio is locked until these destinations settle.</div> : null}

      <Button
        type="button"
        variant="default"
        disabled={busy || !reel.outputUrl || targetCount === 0}
        onClick={() =>
          requestConfirm({
            title: republishingInstagram.length ? "Republish to Instagram?" : "Publish to selected accounts?",
            body: republishingInstagram.length ? `This sends another Reel to ${republishingInstagram.join(", ")}. Only continue if you intentionally removed or want to replace the previous post.` : `Queues this reviewed render for ${targetCount} destination${targetCount === 1 ? "" : "s"}. YouTube receives its title, tags, and thumbnail; Instagram receives the Reel and caption.`,
            details: [
              "Uses the publishing details shown in this Studio panel.",
              "The upload runs in the background — status appears above.",
            ],
            confirmLabel: "Publish",
            onConfirm: () =>
              run(async () => {
                await updateReview(reelKey, {
                  title,
                  description,
                  tags: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
                });
                // The confirmation modal is the explicit user authorization for
                // a resend. Do not infer it from a potentially stale reel
                // snapshot after a previous failed request.
                return distributeReel(reelKey, { youtubeChannelIds: selectedYoutubeIds, instagramChannelIds: selectedInstagramIds, forceRepublish: selectedInstagramIds.length > 0 });
              }),
          })
        }
      >
        <Send size={15} /> Publish to {targetCount || "…"} account{targetCount === 1 ? "" : "s"}
      </Button>
    </div>
  );
}

function DestinationGroup({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) { return <div className="grid gap-1"><div className="inline-flex items-center gap-1 text-xs font-medium text-foreground">{icon}{title}</div>{children}</div>; }
function DestinationOption({ checked, disabled, onChange, label, detail }: { checked: boolean; disabled: boolean; onChange: () => void; label: string; detail: string }) { return <label className="flex cursor-pointer items-center gap-2 rounded border border-border px-2 py-1.5 text-xs hover:bg-secondary"><input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} /><span className="min-w-0 flex-1 truncate font-medium">{label}</span><span className="truncate text-muted-foreground">{detail}</span></label>; }
function PublishOutcome({ label, status, url, error, message, icon }: { label: string; status: string; url?: string; error?: string; message?: string; icon: React.ReactNode }) { return <div className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-xs"><span>{icon}</span><span className="min-w-0 flex-1 truncate font-medium">{label}</span><span className="capitalize text-muted-foreground">{status}</span>{url ? <a href={url} target="_blank" rel="noreferrer" className="text-primary"><ExternalLink size={12} /></a> : null}<span className={cn("max-w-64 truncate", error ? "text-destructive" : "text-muted-foreground")} title={error || message}>{error || message}</span></div>; }

function HashtagSuggestions({ label, tags, selected, onAdd }: { label: string; tags: string[]; selected: string[]; onAdd: (tag: string) => void }) {
  const available = tags.filter((tag) => !selected.includes(tag));
  if (!available.length) return null;
  return <div className="grid gap-1"><span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">{label}</span><div className="flex flex-wrap gap-1">{available.map((tag) => <button key={tag} type="button" onClick={() => onAdd(tag)} className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground">+ {tag}</button>)}</div></div>;
}

// ---- Cinematic edit effects (rain / grain / vignette / letterbox) ----
