import { useEffect, useState } from "react";
import { AtSign, CheckCircle2, ExternalLink, Facebook, Instagram, Loader2, Pencil, Plus, Trash2, Youtube } from "lucide-react";
import {
  deleteInstagramChannel,
  listInstagramChannels,
  listYouTubeChannels,
  startInstagramChannelConnect,
  startYouTubeChannelConnect,
  updateInstagramChannel,
  updateYouTubeChannel,
  deleteYouTubeChannel,
  deleteFacebookPage,
  listFacebookPages,
  startFacebookConnect,
  updateFacebookPage,
  deleteThreadsChannel,
  listThreadsChannels,
  startThreadsConnect,
  updateThreadsChannel,
  type FacebookPageOption,
  type InstagramChannelOption,
  type ThreadsChannelOption,
  type YouTubeChannelOption,
} from "@/api/reels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AccountsScreen() {
  const [instagram, setInstagram] = useState<InstagramChannelOption[]>([]);
  const [youtube, setYoutube] = useState<YouTubeChannelOption[]>([]);
  const [facebook, setFacebook] = useState<FacebookPageOption[]>([]);
  const [threads, setThreads] = useState<ThreadsChannelOption[]>([]);
  const [label, setLabel] = useState("");
  const [youtubeLabel, setYoutubeLabel] = useState("");
  const [facebookLabel, setFacebookLabel] = useState("");
  const [threadsLabel, setThreadsLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [youtubeConnecting, setYoutubeConnecting] = useState(false);
  const [facebookConnecting, setFacebookConnecting] = useState(false);
  const [threadsConnecting, setThreadsConnecting] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  async function load() {
    setLoading(true);
    const [ig, yt, fb, th] = await Promise.allSettled([listInstagramChannels(), listYouTubeChannels(), listFacebookPages(), listThreadsChannels()]);
    setInstagram(ig.status === "fulfilled" ? ig.value : []);
    setYoutube(yt.status === "fulfilled" ? yt.value : []);
    setFacebook(fb.status === "fulfilled" ? fb.value : []);
    setThreads(th.status === "fulfilled" ? th.value : []);
    const failure = ig.status === "rejected" ? ig.reason : yt.status === "rejected" ? yt.reason : undefined;
    setError(failure instanceof Error ? failure.message : undefined);
    setLoading(false);
  }

  /** Shared OAuth-popup connect for the Meta platforms that postMessage back. */
  function connectViaPopup(opts: {
    messageType: string; windowName: string; getAuthUrl: () => Promise<{ authUrl: string }>;
    setBusy: (v: boolean) => void; clearLabel: () => void; failLabel: string;
  }) {
    opts.setBusy(true); setError(undefined); setMessage(undefined);
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== opts.messageType) return;
      window.removeEventListener("message", onMessage);
      opts.setBusy(false);
      if (event.data.success) { opts.clearLabel(); setMessage(event.data.message); void load(); }
      else setError(event.data.message || opts.failLabel);
    };
    window.addEventListener("message", onMessage);
    opts.getAuthUrl()
      .then(({ authUrl }) => {
        const popup = window.open(authUrl, opts.windowName, "width=640,height=820");
        if (!popup) throw new Error("Your browser blocked the login popup. Allow popups and try again.");
      })
      .catch((err) => { window.removeEventListener("message", onMessage); setError(err instanceof Error ? err.message : opts.failLabel); opts.setBusy(false); });
  }

  function connectFacebook() {
    if (!facebookLabel.trim()) { setError("Give this Page an internal nickname first."); return; }
    connectViaPopup({ messageType: "facebook-page-connected", windowName: "facebook-connect", failLabel: "Could not connect Facebook Page.", setBusy: setFacebookConnecting, clearLabel: () => setFacebookLabel(""), getAuthUrl: () => startFacebookConnect({ label: facebookLabel.trim() }) });
  }
  function connectThreads() {
    if (!threadsLabel.trim()) { setError("Give this profile an internal nickname first."); return; }
    connectViaPopup({ messageType: "threads-channel-connected", windowName: "threads-connect", failLabel: "Could not connect Threads profile.", setBusy: setThreadsConnecting, clearLabel: () => setThreadsLabel(""), getAuthUrl: () => startThreadsConnect({ label: threadsLabel.trim() }) });
  }
  async function removeFacebook(id: string) { if (!window.confirm("Disconnect this Facebook Page?")) return; try { await deleteFacebookPage(id); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Could not disconnect Page."); } }
  async function renameFacebook(page: FacebookPageOption) { const label = window.prompt("Internal nickname", page.label); if (!label || label === page.label) return; try { await updateFacebookPage(page.id, { label }); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Could not update Page."); } }
  async function removeThreads(id: string) { if (!window.confirm("Disconnect this Threads profile?")) return; try { await deleteThreadsChannel(id); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Could not disconnect profile."); } }
  async function renameThreads(channel: ThreadsChannelOption) { const label = window.prompt("Internal nickname", channel.label); if (!label || label === channel.label) return; try { await updateThreadsChannel(channel.id, { label }); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Could not update profile."); } }

  useEffect(() => { void load(); }, []);

  async function connectInstagram() {
    if (!label.trim()) { setError("Give this account an internal nickname first."); return; }
    setConnecting(true); setError(undefined); setMessage(undefined);
    try {
      const { authUrl } = await startInstagramChannelConnect({ label: label.trim() });
      const popup = window.open(authUrl, "instagram-connect", "width=580,height=760");
      if (!popup) throw new Error("Your browser blocked the login popup. Allow popups and try again.");
      const onMessage = (event: MessageEvent) => {
        if (event.data?.type !== "instagram-channel-connected") return;
        window.removeEventListener("message", onMessage);
        setConnecting(false);
        if (event.data.success) { setLabel(""); setMessage(event.data.message); void load(); }
        else setError(event.data.message || "Instagram account connection failed.");
      };
      window.addEventListener("message", onMessage);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not start Instagram connection."); setConnecting(false); }
  }

  async function openYouTubeConnect(input: { label: string; channelKey?: string; privacyStatus?: YouTubeChannelOption["privacyStatus"]; categoryId?: string; niches?: string[] }, mode: "connect" | "reconnect") {
    if (!input.label.trim()) { setError("Give this channel an internal nickname first."); return; }
    setYoutubeConnecting(true); setError(undefined); setMessage(undefined);
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "youtube-channel-connected") return;
      window.removeEventListener("message", onMessage);
      setYoutubeConnecting(false);
      if (event.data.success) { setYoutubeLabel(""); setMessage(event.data.message); void load(); }
      else setError(event.data.message || `Could not ${mode} YouTube channel.`);
    };
    window.addEventListener("message", onMessage);
    try {
      const { authUrl } = await startYouTubeChannelConnect(input);
      const popup = window.open(authUrl, "youtube-connect", "width=720,height=820");
      if (!popup) throw new Error("Your browser blocked the Google login popup. Allow popups and try again.");
    } catch (err) {
      window.removeEventListener("message", onMessage);
      setError(err instanceof Error ? err.message : "Could not start YouTube connection.");
      setYoutubeConnecting(false);
    }
  }

  async function reconnectYoutube(channel: YouTubeChannelOption) {
    const displayName = channel.googleChannelTitle || channel.label;
    if (!window.confirm(`Reconnect ${displayName}? Sign in to the Google account that owns this exact YouTube channel. This replaces its stored refresh token.`)) return;
    await openYouTubeConnect({ label: channel.label, channelKey: channel.id, privacyStatus: channel.privacyStatus, categoryId: channel.categoryId, niches: channel.niches }, "reconnect");
  }

  async function removeInstagram(id: string) {
    if (!window.confirm("Disconnect this Instagram account? Publishing history will remain on existing reels.")) return;
    try { await deleteInstagramChannel(id); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not disconnect account."); }
  }
  async function renameInstagram(account: InstagramChannelOption) { const label = window.prompt("Internal nickname", account.label); if (!label || label === account.label) return; try { await updateInstagramChannel(account.id, { label }); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Could not update account."); } }
  async function renameYoutube(channel: YouTubeChannelOption) { if (channel.source === "env") { setError("This channel is configured in YOUTUBE_CHANNELS_JSON. Edit its label there, then restart the server."); return; } const label = window.prompt("Internal nickname", channel.label); if (!label || label === channel.label) return; try { await updateYouTubeChannel(channel.id, { label }); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Could not update channel."); } }
  async function removeYoutube(channel: YouTubeChannelOption) { if (channel.source === "env") { setError("This channel is configured in YOUTUBE_CHANNELS_JSON. Remove it there, then restart the server."); return; } if (!window.confirm("Disconnect this YouTube channel?")) return; try { await deleteYouTubeChannel(channel.id); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Could not disconnect channel."); } }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-5 py-8 lg:px-10">
      <header className="flex flex-col gap-4 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Distribution</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Accounts</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">The channels and creator profiles that receive your finished videos.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-emerald-500" />{instagram.length + youtube.length + facebook.length + threads.length} connected destination{instagram.length + youtube.length + facebook.length + threads.length === 1 ? "" : "s"}</div>
      </header>
      {error ? <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
      {message ? <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700"><CheckCircle2 className="mr-1 inline size-4" />{message}</div> : null}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4"><div><h2 className="inline-flex items-center gap-2 text-base font-semibold"><Instagram size={18} className="text-pink-500" />Instagram</h2><p className="mt-1 text-sm text-muted-foreground">Creator and Business accounts for Reel distribution.</p></div></div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row"><Input value={label} className="sm:max-w-sm" placeholder="Nickname, e.g. Reddit Echo" onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void connectInstagram(); }} /><Button onClick={() => void connectInstagram()} disabled={connecting}>{connecting ? <Loader2 className="size-4 animate-spin" /> : <Plus size={16} />}{connecting ? "Opening login…" : "Connect Instagram"}</Button></div>
          <p className="mt-2 text-xs text-muted-foreground">The selected Instagram account must be a tester while your Meta app is in development mode.</p>
        </div>
        {loading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : instagram.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {instagram.map((account) => <AccountCard key={account.id} avatar={account.profilePictureUrl} fallback={<Instagram size={18} />} title={account.username ? `@${account.username}` : account.label} subtitle={account.label} status={account.status} error={account.lastError} onEdit={() => void renameInstagram(account)} onRemove={() => void removeInstagram(account.id)} />)}
          </div>
        ) : <EmptyState icon={<Instagram size={18} />} text="No Instagram accounts connected." />}
      </section>

      <section className="space-y-4">
        <div><h2 className="inline-flex items-center gap-2 text-base font-semibold"><Youtube size={18} className="text-red-500" />YouTube</h2><p className="mt-1 text-sm text-muted-foreground">Shorts channels connected to the distribution engine.</p></div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row"><Input value={youtubeLabel} className="sm:max-w-sm" placeholder="Nickname, e.g. Lurker's Lore" onChange={(e) => setYoutubeLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void openYouTubeConnect({ label: youtubeLabel }, "connect"); }} /><Button onClick={() => void openYouTubeConnect({ label: youtubeLabel }, "connect")} disabled={youtubeConnecting}>{youtubeConnecting ? <Loader2 className="size-4 animate-spin" /> : <Plus size={16} />}{youtubeConnecting ? "Opening Google…" : "Connect YouTube"}</Button></div>
          <p className="mt-2 text-xs text-muted-foreground">Choose the Google account that owns the channel. The refresh token stays server-side and is only replaced when you explicitly reconnect.</p>
        </div>
        {youtube.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{youtube.map((channel) => <AccountCard key={channel.id} avatar={channel.logoUrl} fallback={<Youtube size={18} />} title={channel.googleChannelTitle || channel.label} subtitle={channel.googleChannelHandle || channel.label} status={channel.status === "needs_reauth" ? "reconnect required" : channel.source === "env" ? "server managed" : channel.privacyStatus} onEdit={() => void renameYoutube(channel)} onReconnect={() => void reconnectYoutube(channel)} reconnecting={youtubeConnecting} onRemove={() => void removeYoutube(channel)} />)}</div> : <EmptyState icon={<Youtube size={18} />} text="No YouTube channels connected." />}
        <p className="text-xs text-muted-foreground"><ExternalLink className="mr-1 inline size-3" />Use Reconnect when Google rejects a credential. It creates a database-backed replacement for an older environment-managed token, without exposing it in the browser.</p>
      </section>

      <section className="space-y-4">
        <div><h2 className="inline-flex items-center gap-2 text-base font-semibold"><Facebook size={18} className="text-blue-600" />Facebook Reels</h2><p className="mt-1 text-sm text-muted-foreground">Pages you administer, for Facebook Reels cross-posting. Requires FACEBOOK_REELS_ENABLED and the Page added to your Meta app.</p></div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row"><Input value={facebookLabel} className="sm:max-w-sm" placeholder="Nickname, e.g. Lore Page" onChange={(e) => setFacebookLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") connectFacebook(); }} /><Button onClick={connectFacebook} disabled={facebookConnecting}>{facebookConnecting ? <Loader2 className="size-4 animate-spin" /> : <Plus size={16} />}{facebookConnecting ? "Opening login…" : "Connect Facebook"}</Button></div>
          <p className="mt-2 text-xs text-muted-foreground">All Pages you administer are imported on connect. Standard Access works for Pages you own — no App Review.</p>
        </div>
        {facebook.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{facebook.map((page) => <AccountCard key={page.id} avatar={page.pictureUrl} fallback={<Facebook size={18} />} title={page.name || page.label} subtitle={page.category || page.label} status={page.status} error={page.lastError} onEdit={() => void renameFacebook(page)} onRemove={() => void removeFacebook(page.id)} />)}</div> : <EmptyState icon={<Facebook size={18} />} text="No Facebook Pages connected." />}
      </section>

      <section className="space-y-4">
        <div><h2 className="inline-flex items-center gap-2 text-base font-semibold"><AtSign size={18} className="text-foreground" />Threads</h2><p className="mt-1 text-sm text-muted-foreground">Owned Threads profiles for low-effort cross-posting. Requires THREADS_ENABLED and the separate Threads Meta app.</p></div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row"><Input value={threadsLabel} className="sm:max-w-sm" placeholder="Nickname, e.g. Lurker Threads" onChange={(e) => setThreadsLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") connectThreads(); }} /><Button onClick={connectThreads} disabled={threadsConnecting}>{threadsConnecting ? <Loader2 className="size-4 animate-spin" /> : <Plus size={16} />}{threadsConnecting ? "Opening login…" : "Connect Threads"}</Button></div>
          <p className="mt-2 text-xs text-muted-foreground">Threads uses its own Meta app + OAuth. The same 9:16 render is reused with a strong text hook.</p>
        </div>
        {threads.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{threads.map((channel) => <AccountCard key={channel.id} avatar={channel.profilePictureUrl} fallback={<AtSign size={18} />} title={channel.username ? `@${channel.username}` : channel.label} subtitle={channel.label} status={channel.status} error={channel.lastError} onEdit={() => void renameThreads(channel)} onRemove={() => void removeThreads(channel.id)} />)}</div> : <EmptyState icon={<AtSign size={18} />} text="No Threads profiles connected." />}
      </section>
    </main>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) { return <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground"><span className="text-muted-foreground">{icon}</span>{text}</div>; }
function AccountCard({ avatar, fallback, title, subtitle, status, error, onEdit, onReconnect, reconnecting, onRemove }: { avatar?: string; fallback: React.ReactNode; title: string; subtitle: string; status: string; error?: string; onEdit: () => void; onReconnect?: () => void; reconnecting?: boolean; onRemove: () => void }) { return <article className="group rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/35"><div className="flex items-start gap-3">{avatar ? <img className="size-11 rounded-full object-cover" src={avatar} alt="" /> : <div className="grid size-11 place-items-center rounded-full bg-secondary text-muted-foreground">{fallback}</div>}<div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{title}</h3><p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p></div><span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-medium capitalize text-muted-foreground">{status}</span></div>{error ? <p className="mt-3 line-clamp-2 text-xs text-destructive">{error}</p> : null}<div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3"><Button size="sm" variant="ghost" onClick={onEdit}><Pencil size={13} />Edit</Button>{onReconnect ? <Button size="sm" variant="ghost" onClick={onReconnect} disabled={reconnecting}>{reconnecting ? <Loader2 className="size-3 animate-spin" /> : <ExternalLink size={13} />}Reconnect</Button> : null}<Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={onRemove}><Trash2 size={13} />Remove</Button></div></article>; }
