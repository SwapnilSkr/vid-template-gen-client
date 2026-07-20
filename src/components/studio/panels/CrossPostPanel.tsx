import { Link } from "@tanstack/react-router";
import { AtSign, ExternalLink, Facebook, Instagram, Loader2, MessageCircle, Send, Sparkles, Youtube } from "lucide-react";
import { useEffect, useState } from "react";
import {
  listFacebookPages,
  listInstagramComments,
  listThreadsChannels,
  listYouTubeComments,
  postInstagramFirstComment,
  postFacebookFirstComment,
  postThreadsFirstReply,
  postYouTubeFirstComment,
  regenerateFacebookDescription,
  regenerateThreadsText,
  replyToInstagramComment,
  replyToYouTubeComment,
  updateReelSettings,
  type FacebookPageOption,
  type OwnPostComment,
  type Reel,
  type ThreadsChannelOption,
} from "@/api/reels";
import type { StudioRun } from "@/components/studio/types";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelTitle } from "@/components/ui/panel";
import { PlatformCommentsSection } from "@/components/studio/panels/PlatformCommentsSection";
import { cn } from "@/lib/utils";

/**
 * Cross-post either the primary 9:16 render or an explicitly configured
 * Facebook/Threads branded destination to owned Pages / profiles,
 * and surface the own-post comment layer (post first comment + read/reply to
 * early comments) for published YouTube/Instagram posts. Own-media only.
 */
function defaultFacebookDescription(reel: Reel): string {
  // Do not show legacy YouTube metadata as if it were Facebook-native copy.
  // Older completed reels start blank and can explicitly generate a current
  // Facebook draft from the focused distribution modal.
  return reel.facebookSettings?.description ?? "";
}

function defaultThreadsText(reel: Reel): string {
  // Likewise, a title fallback is not an actual Threads post draft.
  return reel.threadsSettings?.text ?? "";
}

export function CrossPostPanel({
  reel,
  busy,
  run,
  focus = "all",
  onOpenPublishAccounts,
}: {
  reel: Reel;
  busy: boolean;
  run: StudioRun;
  /** A platform card opens a focused publishing surface; the engagement link
   * keeps the combined workspace. */
  focus?: "all" | "facebook" | "threads";
  onOpenPublishAccounts?: () => void;
}) {
  const reelKey = reel._id ?? reel.id ?? "";
  const [facebook, setFacebook] = useState<FacebookPageOption[]>([]);
  const [threads, setThreads] = useState<ThreadsChannelOption[]>([]);
  const [working, setWorking] = useState<string>();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [connectionError, setConnectionError] = useState<string>();
  const [facebookDescription, setFacebookDescription] = useState(() => defaultFacebookDescription(reel));
  const [threadsText, setThreadsText] = useState(() => defaultThreadsText(reel));
  const showFacebook = focus !== "threads";
  const showThreads = focus !== "facebook";

  useEffect(() => {
    void Promise.allSettled([listFacebookPages(), listThreadsChannels()]).then(([fb, th]) => {
      setFacebook(fb.status === "fulfilled" ? fb.value : []);
      setThreads(th.status === "fulfilled" ? th.value : []);
      const failure = fb.status === "rejected" ? fb.reason : th.status === "rejected" ? th.reason : undefined;
      setConnectionError(failure instanceof Error ? failure.message : undefined);
    });
  }, []);

  useEffect(() => {
    setFacebookDescription(defaultFacebookDescription(reel));
    setThreadsText(defaultThreadsText(reel));
  }, [
    reel._id,
    reel.id,
    reel.facebookSettings?.description,
    reel.threadsSettings?.text,
    reel.review?.description,
    reel.title,
    reel.hook,
    reel.thumbnailHook,
    reel.topic,
  ]);

  if (reel.status !== "completed") return null;
  const disabled = busy || Boolean(working) || !reel.outputUrl;
  const fbByChannel = new Map((reel.facebook ?? []).map((p) => [p.channelId, p]));
  const thByChannel = new Map((reel.threads ?? []).map((p) => [p.channelId, p]));
  const destinationFor = (platform: "facebook" | "threads", channelId: string) =>
    (reel.destinations ?? []).find((destination) => destination.platform === platform && destination.channelId === channelId);
  const renderLabel = (platform: "facebook" | "threads", channelId: string) => {
    const destination = destinationFor(platform, channelId);
    if (!destination) return "using primary render";
    return destination.status === "ready" && destination.outputUrl
      ? "dedicated branded render ready"
      : "dedicated render needs completion";
  };
  const destinationBlocked = (platform: "facebook" | "threads", channelId: string) => {
    const destination = destinationFor(platform, channelId);
    return Boolean(destination && (destination.status !== "ready" || !destination.outputUrl));
  };

  async function act(key: string, fn: () => Promise<unknown>, okMsg: string) {
    setWorking(key); setError(undefined); setMessage(undefined);
    try { await fn(); setMessage(okMsg); }
    catch (err) { setError(err instanceof Error ? err.message : "Action failed."); }
    finally { setWorking(undefined); }
  }

  const publishedInstagram = (reel.instagram ?? []).filter((p) => p.status === "published");
  const publishedFacebook = (reel.facebook ?? []).filter((p) => p.status === "published");
  const publishedThreads = (reel.threads ?? []).filter((p) => p.status === "published");
  const youtubePublished = reel.youtube?.status === "published";
  const hasAnyPublishAttempt = Boolean(
    reel.youtube ||
    (reel.instagram?.length ?? 0) ||
    (reel.facebook?.length ?? 0) ||
    (reel.threads?.length ?? 0),
  );

  async function savePlatformCopy(
    platform: "facebook" | "threads",
    value: string,
  ) {
    const result = await run(() => updateReelSettings(reelKey, {
      [platform]: platform === "facebook" ? { description: value } : { text: value },
    }));
    if (!result.ok) throw new Error(result.error || "Could not save platform copy.");
  }

  async function regeneratePlatformCopy(platform: "facebook" | "threads") {
    let generated: Reel | undefined;
    const result = await run(async () => {
      generated = platform === "facebook"
        ? await regenerateFacebookDescription(reelKey)
        : await regenerateThreadsText(reelKey);
      return generated;
    });
    if (!result.ok || !generated) throw new Error(result.error || "Could not generate platform copy.");
    if (platform === "facebook") setFacebookDescription(generated.facebookSettings?.description ?? "");
    else setThreadsText(generated.threadsSettings?.text ?? "");
  }

  return (
    <div className="grid gap-2 rounded-md border border-border bg-background/35 p-2.5">
      <PanelTitle className="inline-flex items-center gap-2 text-foreground"><Send size={14} className="text-primary" /> {focus === "all" ? "Cross-post settings & engagement" : focus === "facebook" ? "Facebook Reels settings" : "Threads settings"}</PanelTitle>
      <p className="text-[11px] text-muted-foreground">This is the saved source of truth for platform-specific copy. Choose destinations and send posts only from Publish accounts.{focus === "all" ? " The comment layer acts only on your own posts." : ""}</p>
      {error ? <p role="alert" className="m-0 rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">{error}</p> : null}
      {message ? <p role="status" className="m-0 rounded border border-success/40 bg-success/10 px-2 py-1 text-[11px] text-success">{message}</p> : null}

      <div className="grid gap-2 border-b border-border pb-2">
        <div className="text-xs font-medium text-foreground">{focus === "all" ? "Facebook & Threads copy" : `${focus === "facebook" ? "Facebook" : "Threads"} copy`}</div>
        <p className="m-0 text-[11px] text-muted-foreground">Save distinct copy now; it will be used only when you later cross-post to that platform. Generate uses the current platform rules and your owned-platform learning; it never changes the video or publishes anything.</p>
        {showFacebook ? <>
        <Label className="grid gap-1 text-[11px] text-muted-foreground">
          Facebook Reel description
          <Textarea value={facebookDescription} maxLength={2200} rows={3} disabled={disabled} placeholder="Generate a Facebook-specific draft or write one here." onChange={(event) => setFacebookDescription(event.target.value)} />
          <span className="justify-self-end text-[10px] text-muted-foreground/80">{facebookDescription.length}/2,200</span>
          <span className="text-[10px] text-muted-foreground/80">{reel.facebookSettings?.description ? reel.facebookSettings.source === "ai" ? `AI draft · ${reel.facebookSettings.model ?? "configured model"}` : "Saved Facebook-specific draft" : "No Facebook-specific draft yet."}</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => void act("fb-copy", () => savePlatformCopy("facebook", facebookDescription), "Facebook description saved.")}>{working === "fb-copy" ? <Loader2 className="size-3 animate-spin" /> : "Save Facebook description"}</Button>
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => void act("fb-generate", () => regeneratePlatformCopy("facebook"), "Generated and saved a current Facebook description. Edit and save only if you change it.")}>{working === "fb-generate" ? <Loader2 className="size-3 animate-spin" /> : <><Sparkles className="size-3" />{reel.facebookSettings?.description ? "Regenerate Facebook draft" : "Generate Facebook draft"}</>}</Button>
        </div>
        </> : null}
        {showThreads ? <>
        <Label className="grid gap-1 text-[11px] text-muted-foreground">
          Threads post text
          <Textarea value={threadsText} maxLength={500} rows={3} disabled={disabled} placeholder="Generate Threads-specific text or write it here." onChange={(event) => setThreadsText(event.target.value)} />
          <span className="justify-self-end text-[10px] text-muted-foreground/80">{threadsText.length}/500</span>
          <span className="text-[10px] text-muted-foreground/80">{reel.threadsSettings?.text ? reel.threadsSettings.source === "ai" ? `AI draft · ${reel.threadsSettings.model ?? "configured model"}` : "Saved Threads-specific draft" : "No Threads-specific draft yet."}</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => void act("threads-copy", () => savePlatformCopy("threads", threadsText), "Threads text saved.")}>{working === "threads-copy" ? <Loader2 className="size-3 animate-spin" /> : "Save Threads text"}</Button>
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => void act("threads-generate", () => regeneratePlatformCopy("threads"), "Generated and saved current Threads text. Edit and save only if you change it.")}>{working === "threads-generate" ? <Loader2 className="size-3 animate-spin" /> : <><Sparkles className="size-3" />{reel.threadsSettings?.text ? "Regenerate Threads draft" : "Generate Threads draft"}</>}</Button>
        </div>
        </> : null}
      </div>

      <div className="grid gap-2 border-t border-border pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-medium text-foreground">Connected destinations</span><Link to="/accounts" className="text-[11px] font-medium text-primary underline-offset-2 hover:underline">Manage accounts →</Link></div>
        <p className="m-0 text-[11px] text-muted-foreground">Each account shows the render it would use. Select it in Publish accounts when you are ready to send.</p>
        {connectionError ? <p role="status" className="m-0 text-[11px] text-warning">Could not load every cross-post account: {connectionError}</p> : null}
        {showFacebook ? <div className="grid gap-1">
          <div className="inline-flex items-center gap-1 text-xs font-medium text-foreground"><Facebook size={13} className="text-blue-600" /> Facebook Reels</div>
          {facebook.length ? facebook.map((page) => { const st = fbByChannel.get(page.id); const blocked = destinationBlocked("facebook", page.id); return (
            <div key={page.id} className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-xs">
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{page.name || page.label}</span><span className="block text-[10px] text-muted-foreground">{renderLabel("facebook", page.id)}</span></span>
              <StatusPill status={st?.status} url={st?.url} />
              <Button size="sm" variant="outline" disabled={busy || !reel.outputUrl || blocked || page.status !== "active"} onClick={onOpenPublishAccounts}>Choose in Publish accounts</Button>
            </div>
          ); }) : <p className="m-0 rounded border border-dashed border-border px-2 py-1.5 text-[11px] text-muted-foreground">No Facebook Page connected. Add one from Accounts.</p>}
        </div> : null}

        {showThreads ? <div className="grid gap-1">
          <div className="inline-flex items-center gap-1 text-xs font-medium text-foreground"><AtSign size={13} /> Threads</div>
          {threads.length ? threads.map((channel) => { const st = thByChannel.get(channel.id); const blocked = destinationBlocked("threads", channel.id); return (
            <div key={channel.id} className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-xs">
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{channel.username ? `@${channel.username}` : channel.label}</span><span className="block text-[10px] text-muted-foreground">{renderLabel("threads", channel.id)}</span></span>
              <StatusPill status={st?.status} url={st?.url} />
              <Button size="sm" variant="outline" disabled={busy || !reel.outputUrl || blocked || channel.status !== "active"} onClick={onOpenPublishAccounts}>Choose in Publish accounts</Button>
            </div>
          ); }) : <p className="m-0 rounded border border-dashed border-border px-2 py-1.5 text-[11px] text-muted-foreground">No Threads profile connected. Add one from Accounts.</p>}
        </div> : null}
      </div>

      {focus === "all" ? (
        <div className="grid gap-2 border-t border-border pt-2">
          <PlatformCommentsSection reel={reel} />
          {hasAnyPublishAttempt && (youtubePublished || publishedInstagram.length || publishedFacebook.length || publishedThreads.length) ? (
            <div className="grid gap-1.5">
              <div className="inline-flex items-center gap-1 text-xs font-medium text-foreground"><MessageCircle size={13} className="text-primary" /> Comment actions</div>
              {youtubePublished ? (
                <CommentBlock
                  icon={<Youtube size={12} className="text-red-500" />}
                  label={reel.youtube?.channelLabel || "YouTube"}
                  firstCommentStatus={reel.youtube?.firstCommentStatus}
                  navigationStatus={reel.youtube?.seriesNavigationStatus}
                  disabled={disabled}
                  onPostFirst={() => act("yt-fc", () => postYouTubeFirstComment(reelKey, reel.youtube?.channelId), "Posted first comment.")}
                  working={working === "yt-fc"}
                  loadComments={() => listYouTubeComments(reelKey, reel.youtube?.channelId ?? "default")}
                  reply={(commentId, msg) => replyToYouTubeComment(reel.youtube?.channelId ?? "default", commentId, msg)}
                />
              ) : null}
              {publishedInstagram.map((publish) => (
                <CommentBlock
                  key={publish.channelId}
                  icon={<Instagram size={12} className="text-pink-500" />}
                  label={publish.channelLabel || publish.channelId}
                  firstCommentStatus={publish.firstCommentStatus}
                  navigationStatus={publish.seriesNavigationStatus}
                  disabled={disabled}
                  onPostFirst={() => act(`ig-fc:${publish.channelId}`, () => postInstagramFirstComment(reelKey, publish.channelId), "Posted first comment.")}
                  working={working === `ig-fc:${publish.channelId}`}
                  loadComments={() => listInstagramComments(reelKey, publish.channelId)}
                  reply={(commentId, msg) => replyToInstagramComment(publish.channelId, commentId, msg)}
                />
              ))}
              {publishedFacebook.map((publish) => (
                <CommentPostBlock key={publish.channelId} icon={<Facebook size={12} className="text-blue-600" />} label={publish.channelLabel || publish.channelId} firstCommentStatus={publish.firstCommentStatus} navigationStatus={publish.seriesNavigationStatus} disabled={disabled} onPostFirst={() => act(`fb-fc:${publish.channelId}`, () => postFacebookFirstComment(reelKey, publish.channelId), "Posted discussion comment. Live-part navigation will post only when verified.")} working={working === `fb-fc:${publish.channelId}`} />
              ))}
              {publishedThreads.map((publish) => (
                <CommentPostBlock key={publish.channelId} icon={<AtSign size={12} />} label={publish.channelLabel || publish.channelId} firstCommentStatus={publish.firstCommentStatus} navigationStatus={publish.seriesNavigationStatus} disabled={disabled} onPostFirst={() => act(`threads-fc:${publish.channelId}`, () => postThreadsFirstReply(reelKey, publish.channelId), "Posted discussion reply. Live-part navigation will post only when verified.")} working={working === `threads-fc:${publish.channelId}`} />
              ))}
              <p className="m-0 text-[11px] text-muted-foreground/80">Manual post actions only appear for successful uploads. Instagram cannot pin an app-posted comment — pinning stays manual in Instagram.</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ status, url }: { status?: string; url?: string }) {
  if (!status) return <span className="text-[10px] text-muted-foreground">not sent</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] capitalize", status === "published" ? "bg-success/10 text-success" : status === "failed" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning")}>
      {status}{url ? <a href={url} target="_blank" rel="noreferrer" className="text-primary"><ExternalLink size={10} /></a> : null}
    </span>
  );
}

function CommentBlock({ icon, label, firstCommentStatus, navigationStatus, disabled, onPostFirst, working, loadComments, reply }: {
  icon: React.ReactNode; label: string; firstCommentStatus?: string; navigationStatus?: string; disabled: boolean; working: boolean;
  onPostFirst: () => void; loadComments: () => Promise<OwnPostComment[]>; reply: (commentId: string, message: string) => Promise<unknown>;
}) {
  const [comments, setComments] = useState<OwnPostComment[]>();
  const [loading, setLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<string>();
  const [replyText, setReplyText] = useState("");
  const [localError, setLocalError] = useState<string>();

  async function load() {
    setLoading(true); setLocalError(undefined);
    try { setComments(await loadComments()); }
    catch (err) { setLocalError(err instanceof Error ? err.message : "Could not load comments."); }
    finally { setLoading(false); }
  }
  async function sendReply(commentId: string) {
    if (!replyText.trim()) return;
    setLocalError(undefined);
    try { await reply(commentId, replyText.trim()); setReplyText(""); setReplyTo(undefined); await load(); }
    catch (err) { setLocalError(err instanceof Error ? err.message : "Could not reply."); }
  }

  return (
    <div className="grid gap-1 rounded border border-border bg-card/50 p-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 font-medium">{icon}{label}</span>
        <span className="ml-auto text-[10px] capitalize text-muted-foreground">discussion: {firstCommentStatus ?? "not posted"} · navigation: {navigationStatus ?? "waiting"}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" disabled={disabled} onClick={onPostFirst}>{working ? <Loader2 className="size-3 animate-spin" /> : "Post first comment"}</Button>
        <Button size="sm" variant="ghost" disabled={loading} onClick={() => void load()}>{loading ? <Loader2 className="size-3 animate-spin" /> : "Load comments"}</Button>
      </div>
      {localError ? <p className="m-0 text-[11px] text-destructive">{localError}</p> : null}
      {comments ? (comments.length ? (
        <div className="grid gap-1">
          {comments.map((c) => (
            <div key={c.id} className="grid gap-1 rounded border border-border/70 px-2 py-1 text-[11px]">
              <div><span className="font-medium">{c.author || c.username || "viewer"}</span> · <span className="text-muted-foreground">{c.text}</span></div>
              {replyTo === c.id ? (
                <div className="flex gap-1"><Input value={replyText} placeholder="Reply…" onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void sendReply(c.id); }} /><Button size="sm" variant="outline" onClick={() => void sendReply(c.id)}>Send</Button></div>
              ) : (
                <button type="button" className="justify-self-start text-primary" onClick={() => { setReplyTo(c.id); setReplyText(""); }}>Reply</button>
              )}
            </div>
          ))}
        </div>
      ) : <p className="m-0 text-[11px] text-muted-foreground">No comments yet.</p>) : null}
    </div>
  );
}

function CommentPostBlock({ icon, label, firstCommentStatus, navigationStatus, disabled, onPostFirst, working }: {
  icon: React.ReactNode; label: string; firstCommentStatus?: string; navigationStatus?: string; disabled: boolean; onPostFirst: () => void; working: boolean;
}) {
  return (
    <div className="grid gap-1 rounded border border-border bg-card/50 p-2">
      <div className="flex items-center gap-2 text-xs"><span className="inline-flex items-center gap-1 font-medium">{icon}{label}</span><span className="ml-auto text-[10px] capitalize text-muted-foreground">discussion: {firstCommentStatus ?? "not posted"} · navigation: {navigationStatus ?? "waiting"}</span></div>
      <Button size="sm" variant="outline" className="justify-self-start" disabled={disabled} onClick={onPostFirst}>{working ? <Loader2 className="size-3 animate-spin" /> : "Post discussion comment"}</Button>
    </div>
  );
}
