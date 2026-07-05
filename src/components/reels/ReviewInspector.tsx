import {
  BookOpen,
  CheckCircle2,
  Clapperboard,
  ExternalLink,
  FileText,
  GitBranch,
  Image,
  Palette,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCircle,
  X,
  Youtube,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { listFonts, listArtStyles, type FontOption, type Reel, type ReelReview, type ArtStyleOption } from "@/api/reels";
import { Button, buttonClassName } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelTitle, panelClassName } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { useReelStudio } from "@/store/reel-studio";
import { reelId, reelTopStatus } from "@/utils/reel";

interface ReviewInspectorProps {
  reel?: Reel;
  review?: ReelReview;
  selectedId?: string;
}

export function ReviewInspector({ reel, review, selectedId }: ReviewInspectorProps) {
  return <ReviewInspectorForm key={selectedId ?? "none"} reel={reel} review={review} />;
}

function ReviewInspectorForm({ reel, review }: Omit<ReviewInspectorProps, "selectedId">) {
  const loading = useReelStudio((state) => state.loading);
  const saveReview = useReelStudio((state) => state.saveReview);
  const regenerateThumbnail = useReelStudio((state) => state.regenerateThumbnail);
  const useFrameAsThumbnail = useReelStudio((state) => state.useFrameAsThumbnail);
  const useCustomThumbnail = useReelStudio((state) => state.useCustomThumbnail);
  const approveReview = useReelStudio((state) => state.approveReview);
  const publish = useReelStudio((state) => state.publish);
  const deleteSelected = useReelStudio((state) => state.deleteSelected);
  const youtubeChannels = useReelStudio((state) => state.youtubeChannels);
  const loadYouTubeChannels = useReelStudio((state) => state.loadYouTubeChannels);
  const connectYouTubeChannel = useReelStudio((state) => state.connectYouTubeChannel);
  const removeYouTubeChannel = useReelStudio((state) => state.removeYouTubeChannel);
  const previewTimeSeconds = useReelStudio((state) => state.previewTimeSeconds);

  const [draft, setDraft] = useState<ReelReview | undefined>(review);
  const [frameSeconds, setFrameSeconds] = useState("1");
  const [pendingFrameSeconds, setPendingFrameSeconds] = useState<number | undefined>();
  const [fonts, setFonts] = useState<FontOption[]>([]);
  const [customText, setCustomText] = useState("");
  const [customFont, setCustomFont] = useState("");
  const [customSize, setCustomSize] = useState(120);
  const [customColor, setCustomColor] = useState("#FFFFFF");
  const [customOutline, setCustomOutline] = useState("#000000");
  const [customPos, setCustomPos] = useState<"top" | "middle" | "bottom">("bottom");
  const [customCaps, setCustomCaps] = useState(true);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [showChannelConnect, setShowChannelConnect] = useState(false);
  const [newChannelLabel, setNewChannelLabel] = useState("");
  const [newChannelPrivacy, setNewChannelPrivacy] = useState<"private" | "unlisted" | "public">("public");
  const [newChannelPreset, setNewChannelPreset] = useState<"reddit" | "horror" | "both">("reddit");
  const [channelConnectMessage, setChannelConnectMessage] = useState("");
  const [hasUnsavedReviewEdits, setHasUnsavedReviewEdits] = useState(false);
  const tagsText = useMemo(() => draft?.tags.join(", ") ?? "", [draft?.tags]);
  const selectedChannel = useMemo(
    () => youtubeChannels.find((channel) => channel.id === selectedChannelId),
    [selectedChannelId, youtubeChannels]
  );

  useEffect(() => {
    if (!hasUnsavedReviewEdits) setDraft(review);
  }, [hasUnsavedReviewEdits, review]);

  useEffect(() => {
    void listFonts()
      .then((list) => {
        setFonts(list);
        setCustomFont((current) => current || list[0]?.family || "");
      })
      .catch(() => setFonts([]));
  }, []);

  useEffect(() => {
    if (draft?.title && !customText) setCustomText(draft.title);
  }, [draft?.title, customText]);

  async function createCustomTextThumbnail() {
    const atSeconds = pendingFrameSeconds ?? previewTimeSeconds;
    await useCustomThumbnail({
      atSeconds,
      text: customText.trim(),
      fontFamily: customFont || undefined,
      fontSize: customSize,
      color: customColor,
      outlineColor: customOutline,
      position: customPos,
      uppercase: customCaps,
    });
    setPendingFrameSeconds(undefined);
  }

  useEffect(() => {
    const defaultChannel =
      reel?.youtube?.channelId ??
      reel?.outroChannelId ??
      youtubeChannels.find((channel) => channel.isDefault)?.id ??
      youtubeChannels[0]?.id ??
      "";
    setSelectedChannelId(defaultChannel);
  }, [reel?.outroChannelId, reel?.youtube?.channelId, youtubeChannels]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "youtube-channel-connected") {
        if (event.data.success) {
          void loadYouTubeChannels();
          setShowChannelConnect(false);
          setChannelConnectMessage(event.data.message ?? "YouTube channel connected.");
        } else {
          setChannelConnectMessage(
            event.data.message ??
              "Google did not grant access. Start again and approve the requested YouTube permissions."
          );
        }
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [loadYouTubeChannels]);

  async function connectChannel() {
    setChannelConnectMessage("");
    const niches =
      newChannelPreset === "reddit"
        ? ["reddit", "reddit_stories", "aita"]
        : newChannelPreset === "horror"
          ? ["horror", "horror_comic", "analog_horror"]
          : ["reddit", "reddit_stories", "aita", "horror", "horror_comic", "analog_horror"];
    const authUrl = await connectYouTubeChannel({
      label: newChannelLabel.trim(),
      privacyStatus: newChannelPrivacy,
      niches,
    });
    if (authUrl) {
      window.open(authUrl, "youtube-connect", "width=720,height=820");
    }
  }

  const completed = reel?.status === "completed";
  const canReview = completed && Boolean(draft);
  const costBreakdown = reel?.costBreakdown;
  const youtubeStatus = reel?.youtube?.status;
  const publishInFlight = youtubeStatus === "pending" || youtubeStatus === "uploading";
  const publishButtonLabel =
    youtubeStatus === "published"
      ? "Republish to YouTube Shorts"
      : youtubeStatus === "failed"
        ? "Retry YouTube Publish"
        : publishInFlight
          ? youtubeStatus === "uploading"
            ? "Uploading to YouTube..."
            : "YouTube publish queued..."
          : "Publish to YouTube Shorts";

  const channelPresetHelp =
    newChannelPreset === "reddit"
      ? "Used for Reddit stories, AITA, and gameplay reels."
      : newChannelPreset === "horror"
        ? "Used for AI horror, comic horror, and analog horror reels."
        : "Used for both Reddit and horror generation defaults.";

  function updateDraft(updater: (current: ReelReview) => ReelReview) {
    setHasUnsavedReviewEdits(true);
    setDraft((current) => (current ? updater(current) : current));
  }

  async function saveDraftReview(nextDraft = draft): Promise<ReelReview | undefined> {
    if (!nextDraft) return undefined;
    await saveReview(nextDraft);
    setHasUnsavedReviewEdits(false);
    return nextDraft;
  }

  async function approveDraftReview() {
    if (!draft) return;
    await saveDraftReview({ ...draft, status: "approved" });
    await approveReview();
  }

  async function regenerateDraftThumbnail() {
    if (!draft) return;
    await regenerateThumbnail(draft);
    setPendingFrameSeconds(undefined);
    setHasUnsavedReviewEdits(false);
  }

  function selectPreviewFrame(seconds: number) {
    const selected = Math.max(seconds, 0);
    setPendingFrameSeconds(selected);
    setFrameSeconds(selected.toFixed(1));
  }

  async function savePendingFrameThumbnail(): Promise<void> {
    if (pendingFrameSeconds === undefined) return;
    await useFrameAsThumbnail(pendingFrameSeconds);
    setPendingFrameSeconds(undefined);
  }

  function useCurrentPreviewFrame() {
    selectPreviewFrame(previewTimeSeconds);
  }

  function useTypedFrameTime() {
    selectPreviewFrame(Number(frameSeconds) || 0);
  }

  async function commitReviewBeforePublish() {
    if (pendingFrameSeconds !== undefined) await savePendingFrameThumbnail();
    if (hasUnsavedReviewEdits) await saveDraftReview();
  }

  async function publishDraftReview() {
    await commitReviewBeforePublish();
    await publish(selectedChannelId || undefined);
  }

  function pendingFrameLabel() {
    if (pendingFrameSeconds === undefined) return "No frame selected";
    return `Selected frame at ${pendingFrameSeconds.toFixed(1)}s. Save it once before publishing.`;
  }

  function channelName(channel: typeof youtubeChannels[number]) {
    return channel.googleChannelTitle || channel.label;
  }

  function channelHandle(channel: typeof youtubeChannels[number]) {
    return channel.googleChannelHandle
      ? channel.googleChannelHandle.replace(/^@?/, "@")
      : channel.googleChannelId
        ? `ID ${channel.googleChannelId}`
        : channel.source === "env"
          ? "Server default"
          : "Connected account";
  }

  function channelPurpose(channel: typeof youtubeChannels[number]) {
    const niches = channel.niches ?? [];
    if (niches.some((niche) => niche.startsWith("horror"))) return "Horror";
    if (niches.some((niche) => niche.startsWith("reddit") || niche === "aita")) return "Reddit";
    return channel.isDefault ? "Default" : "General";
  }

  return (
    <aside className={cn(panelClassName, "grid gap-3 p-3.5 xl:sticky xl:top-4")}>
      <div className="flex items-center justify-between gap-3">
        <PanelTitle>Review Package</PanelTitle>
        <span className="rounded-full bg-warning px-2.5 py-1 text-xs font-extrabold text-warning-foreground">
          {reelTopStatus(reel, draft)}
        </span>
      </div>

      {reel ? (
        <Link
          to="/studio/$id"
          params={{ id: reelId(reel) }}
          className={cn(
            buttonClassName("outline"),
            reel.status === "plan_review" && "border-warning/50 text-warning"
          )}
        >
          <Sparkles size={16} />
          {reel.status === "plan_review" ? "Review plan in Studio" : "Open in Studio"}
        </Link>
      ) : null}

      <StoryFlowPanel reel={reel} />

      <StyleLookPanel reel={reel} />

      <Label>
        Title
        <Input
          value={draft?.title ?? ""}
          disabled={!completed}
          maxLength={100}
          onChange={(event) => updateDraft((current) => ({ ...current, title: event.target.value }))}
        />
        <small className="justify-self-end text-xs text-muted-foreground">{draft?.title?.length ?? 0}/100</small>
      </Label>

      <Label>
        Description
        <Textarea
          value={draft?.description ?? ""}
          disabled={!completed}
          rows={5}
          maxLength={500}
          onChange={(event) => updateDraft((current) => ({ ...current, description: event.target.value }))}
        />
        <small className="justify-self-end text-xs text-muted-foreground">{draft?.description?.length ?? 0}/500</small>
      </Label>

      <Label>
        Tags
        <Input
          value={tagsText}
          disabled={!completed}
          placeholder="shorts, redditstories, aita"
          onChange={(event) =>
            updateDraft((current) => ({
              ...current,
              tags: event.target.value.split(",").map((tag) => tag.trim()),
            }))
          }
        />
      </Label>

      <div className="grid gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <PanelTitle>Thumbnail</PanelTitle>
          <span className="text-xs text-muted-foreground">Selected before publish</span>
        </div>

        {draft?.thumbnailUrl ? (
          <img
            className="aspect-video w-full rounded-lg border border-border object-cover"
            src={draft.thumbnailUrl}
            alt="Reviewed thumbnail"
          />
        ) : (
          <div className="grid aspect-video w-full place-items-center gap-2 rounded-lg border border-border bg-muted text-[13px] font-bold text-muted-foreground">
            <Image size={22} />
            Thumbnail appears after render
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Label className="gap-0">
            <Input
              type="number"
              min={0}
              step="0.5"
              value={frameSeconds}
              disabled={!completed}
              onChange={(event) => setFrameSeconds(event.target.value)}
              placeholder="Seconds into video"
            />
          </Label>
          <Button
            type="button"
            variant="outline"
            disabled={!canReview || loading}
            onClick={() => useTypedFrameTime()}
          >
            <Clapperboard size={16} />
            Select Time
          </Button>
        </div>

        <Button
          type="button"
          variant="default"
          disabled={!canReview || loading}
          onClick={() => void useCurrentPreviewFrame()}
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <Clapperboard size={16} />}
          Select Current Preview Frame ({previewTimeSeconds.toFixed(1)}s)
        </Button>

        <div className="grid gap-2 rounded-md border border-border bg-muted/35 p-2.5">
          <span className="text-xs font-semibold text-muted-foreground">{pendingFrameLabel()}</span>
          <Button
            type="button"
            variant="outline"
            disabled={!canReview || loading || pendingFrameSeconds === undefined}
            onClick={() => void savePendingFrameThumbnail()}
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <Clapperboard size={16} />}
            Save Selected Frame Thumbnail
          </Button>
        </div>

        <Label>
          AI concept prompt
          <Textarea
            value={draft?.thumbnailPrompt ?? ""}
            disabled={!completed}
            rows={3}
            onChange={(event) => updateDraft((current) => ({ ...current, thumbnailPrompt: event.target.value }))}
          />
        </Label>

        <Button
          type="button"
          variant="outline"
          disabled={!canReview || loading}
          onClick={() => void regenerateDraftThumbnail()}
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          Generate AI Thumbnail
        </Button>

        <div className="grid gap-2 rounded-md border border-border bg-muted/35 p-2.5">
          <span className="inline-flex items-center gap-2 text-xs font-extrabold text-foreground">
            <FileText size={14} /> Custom text thumbnail (your font)
          </span>
          <span className="text-[11px] text-muted-foreground">
            Uses the selected frame ({(pendingFrameSeconds ?? previewTimeSeconds).toFixed(1)}s) with your caption
            burned across it — a manual variant to the AI thumbnail.
          </span>
          <Input
            value={customText}
            disabled={!completed}
            maxLength={120}
            placeholder="Thumbnail caption text"
            onChange={(event) => setCustomText(event.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Label className="gap-0 text-xs">
              Font
              <Select
                value={customFont}
                disabled={!completed}
                onChange={(event) => setCustomFont(event.target.value)}
              >
                {fonts.map((font) => (
                  <option key={font.id} value={font.family}>
                    {font.label}
                  </option>
                ))}
              </Select>
            </Label>
            <Label className="gap-0 text-xs">
              Position
              <Select
                value={customPos}
                disabled={!completed}
                onChange={(event) => setCustomPos(event.target.value as "top" | "middle" | "bottom")}
              >
                <option value="bottom">Bottom</option>
                <option value="middle">Middle</option>
                <option value="top">Top</option>
              </Select>
            </Label>
            <Label className="gap-0 text-xs">
              Size
              <Input
                type="number"
                min={20}
                max={400}
                value={customSize}
                disabled={!completed}
                onChange={(event) => setCustomSize(Number(event.target.value) || 120)}
              />
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Label className="gap-0 text-xs">
                Text
                <input
                  type="color"
                  className="h-9 w-full rounded border border-border bg-background"
                  value={customColor}
                  disabled={!completed}
                  onChange={(event) => setCustomColor(event.target.value)}
                />
              </Label>
              <Label className="gap-0 text-xs">
                Outline
                <input
                  type="color"
                  className="h-9 w-full rounded border border-border bg-background"
                  value={customOutline}
                  disabled={!completed}
                  onChange={(event) => setCustomOutline(event.target.value)}
                />
              </Label>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={customCaps}
              disabled={!completed}
              onChange={(event) => setCustomCaps(event.target.checked)}
            />
            ALL CAPS
          </label>
          <Button
            type="button"
            variant="default"
            disabled={!canReview || loading || !customText.trim()}
            onClick={() => void createCustomTextThumbnail()}
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
            Create text thumbnail
          </Button>
        </div>
      </div>

      <div className="rounded-lg bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        {draft?.visibilityNotes ?? "Visibility guidance appears after the reel finishes."}
      </div>

      {costBreakdown ? (
        <div className="grid gap-2 rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-extrabold text-foreground">
              <ReceiptText size={16} />
              Generation Cost
            </span>
            <span className="text-sm font-extrabold text-foreground">
              ${costBreakdown.totalUsd.toFixed(4)}
            </span>
          </div>
          <div className="grid gap-1.5">
            {costBreakdown.lines.map((line) => (
              <div key={`${line.label}-${line.model ?? line.unit}`} className="grid gap-0.5 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-foreground">{line.label}</span>
                  <span className="font-bold text-foreground">${line.costUsd.toFixed(4)}</span>
                </div>
                <span className="truncate text-muted-foreground">
                  {line.units} {line.unit} × ${line.unitCostUsd.toFixed(5)}
                  {line.model ? ` · ${line.model}` : ""}
                </span>
              </div>
            ))}
          </div>
          {costBreakdown.note ? (
            <p className="m-0 text-xs leading-relaxed text-muted-foreground">{costBreakdown.note}</p>
          ) : null}
        </div>
      ) : null}

      <Label>
        Publish Status
        <Select
          disabled={!completed}
          value={draft?.status ?? "draft"}
          onChange={(event) =>
            updateDraft((current) => ({ ...current, status: event.target.value as ReelReview["status"] }))
          }
        >
          <option value="draft">Draft</option>
          <option value="ready">In Review</option>
          <option value="approved">Approved</option>
        </Select>
      </Label>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" disabled={!canReview} onClick={() => void saveDraftReview()}>
          <RefreshCw size={16} />
          {hasUnsavedReviewEdits ? "Save Changes" : "Saved"}
        </Button>
        <Button type="button" variant="default" disabled={!canReview} onClick={() => void approveDraftReview()}>
          <CheckCircle2 size={16} />
          Approve
        </Button>
      </div>

      <div className="grid gap-2.5 rounded-lg border border-border bg-muted/25 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-extrabold text-foreground">
            <Youtube size={17} />
            YouTube Publishing
          </span>
          <span className="text-xs font-bold text-muted-foreground">
            {youtubeChannels.length} channel{youtubeChannels.length === 1 ? "" : "s"}
          </span>
        </div>

        <Label>
          Publish destination
          <Select
            disabled={!completed || publishInFlight || youtubeChannels.length === 0}
            value={selectedChannelId}
            onChange={(event) => setSelectedChannelId(event.target.value)}
          >
            {youtubeChannels.length === 0 ? (
              <option value="">No connected channel</option>
            ) : (
              youtubeChannels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channelName(channel)} · {channelPurpose(channel)} · {channel.privacyStatus}
                </option>
              ))
            )}
          </Select>
        </Label>

        {selectedChannel ? (
          <div className="flex items-center gap-3 rounded-md border border-border bg-background/70 p-2.5">
            {selectedChannel.logoUrl ? (
              <img
                className="h-11 w-11 shrink-0 rounded-full border border-border object-cover"
                src={selectedChannel.logoUrl}
                alt=""
              />
            ) : (
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-muted text-muted-foreground">
                <UserCircle size={24} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-extrabold text-foreground">
                {channelName(selectedChannel)}
              </div>
              <div className="truncate text-xs font-semibold text-muted-foreground">
                {channelHandle(selectedChannel)}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                  {channelPurpose(selectedChannel)}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                  {selectedChannel.privacyStatus}
                </span>
                {selectedChannel.source === "env" ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                    server default
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-warning/35 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
            Add a YouTube channel before publishing.
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-foreground">Channel Accounts</span>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowChannelConnect((current) => !current)}
            title={showChannelConnect ? "Close add channel" : "Add YouTube channel"}
          >
            {showChannelConnect ? <X size={16} /> : <Plus size={16} />}
            {showChannelConnect ? "Close" : "Add Channel"}
          </Button>
        </div>

        {showChannelConnect ? (
          <div className="grid gap-2 rounded-md border border-border bg-background/70 p-2.5">
            <Label>
              Internal nickname
              <Input
                value={newChannelLabel}
                placeholder="Example: Horror Main"
                onChange={(event) => setNewChannelLabel(event.target.value)}
              />
              <small className="text-xs text-muted-foreground">
                Only used inside this app. The real YouTube name and logo are pulled from Google after connect.
              </small>
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Label>
                Content type
                <Select
                  value={newChannelPreset}
                  onChange={(event) => setNewChannelPreset(event.target.value as "reddit" | "horror" | "both")}
                >
                  <option value="reddit">Reddit stories</option>
                  <option value="horror">Horror reels</option>
                  <option value="both">Both</option>
                </Select>
              </Label>
              <Label>
                Default privacy
                <Select
                  value={newChannelPrivacy}
                  onChange={(event) =>
                    setNewChannelPrivacy(event.target.value as "private" | "unlisted" | "public")
                  }
                >
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </Select>
              </Label>
            </div>
            <Button
              type="button"
              variant="default"
              disabled={loading || !newChannelLabel.trim()}
              onClick={() => void connectChannel()}
            >
              <ExternalLink size={16} />
              Connect with Google
            </Button>
            {channelConnectMessage ? (
              <p className="text-xs font-semibold text-warning">{channelConnectMessage}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {channelPresetHelp} Pick the Google account that owns the channel, then approve YouTube upload and channel read access.
              </p>
            )}
          </div>
        ) : null}

        {youtubeChannels.filter((channel) => channel.source === "database").length > 0 ? (
          <div className="grid gap-2">
            {youtubeChannels
              .filter((channel) => channel.source === "database")
              .map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/60 p-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {channel.logoUrl ? (
                      <img
                        className="h-8 w-8 shrink-0 rounded-full border border-border object-cover"
                        src={channel.logoUrl}
                        alt=""
                      />
                    ) : (
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-muted">
                        <UserCircle size={18} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-extrabold text-foreground">{channelName(channel)}</div>
                      <div className="truncate font-semibold text-muted-foreground">
                        {channel.label} · {channelPurpose(channel)} · {channel.privacyStatus}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Remove channel"
                    disabled={loading}
                    onClick={() => void removeYouTubeChannel(channel.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
          </div>
        ) : null}
      </div>

      <Button
        type="button"
        variant="default"
        className="w-full"
        disabled={!completed || publishInFlight || loading}
        onClick={() => void publishDraftReview()}
      >
        {publishInFlight ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
        {publishButtonLabel}
      </Button>

      {reel?.youtube ? (
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-xs leading-relaxed",
            reel.youtube.status === "failed"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-border bg-muted/40 text-muted-foreground"
          )}
        >
          <div className="font-bold text-foreground">
            YouTube: {reel.youtube.status === "pending" ? "Queued" : reel.youtube.status}
          </div>
          {reel.youtube.channelLabel || reel.youtube.channelId ? (
            <div>Channel: {reel.youtube.channelLabel ?? reel.youtube.channelId}</div>
          ) : null}
          {reel.youtube.error ? <div>{reel.youtube.error}</div> : null}
          {reel.youtube.thumbnailStatus ? (
            <div>
              Thumbnail:{" "}
              {reel.youtube.thumbnailStatus === "uploaded"
                ? "uploaded"
                : reel.youtube.thumbnailStatus === "failed"
                  ? "not uploaded"
                : reel.youtube.thumbnailStatus}
            </div>
          ) : null}
          {reel.youtube.thumbnailError ? <div>{thumbnailPublishMessage(reel.youtube.thumbnailError)}</div> : null}
          {reel.youtube.publishedAt ? (
            <div>Published {new Date(reel.youtube.publishedAt).toLocaleString()}</div>
          ) : null}
        </div>
      ) : null}

      {reel ? (
        <Button
          type="button"
          variant="outline"
          className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={loading}
          onClick={() => {
            const ok = window.confirm(
              "Delete this reel and its recorded S3 assets? Global gameplay clips and voice samples will not be touched."
            );
            if (ok) void deleteSelected();
          }}
        >
          <Trash2 size={17} />
          Delete Reel + Assets
        </Button>
      ) : null}

      {reel?.youtube?.url ? (
        <a
          className="text-center text-[13px] font-bold text-primary no-underline"
          href={reel.youtube.url}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink className="inline align-[-2px]" size={14} /> Open published Short
        </a>
      ) : null}
    </aside>
  );
}

function thumbnailPublishMessage(error: string): string {
  if (/permissions to upload and set custom video thumbnails/i.test(error)) {
    return "This YouTube channel cannot set custom thumbnails yet. Enable custom thumbnails/advanced features in YouTube Studio, then reconnect or retry publish.";
  }
  return error;
}

function StyleLookPanel({ reel }: { reel?: Reel }) {
  const [artStyles, setArtStyles] = useState<ArtStyleOption[]>([]);

  const isHorror = Boolean(reel && (reel.niche.startsWith("horror") || reel.artStyleId));

  useEffect(() => {
    if (!isHorror) return;
    void listArtStyles("horror").then(setArtStyles).catch(() => setArtStyles([]));
  }, [isHorror]);

  if (!reel || !isHorror) return null;

  const artStyle = artStyles.find((s) => s.id === reel.artStyleId);
  const motionLabel = reel.motionMode?.replace(/_/g, " ") ?? "not set";

  return (
    <div className="grid gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3">
      <div className="flex items-center gap-2 text-sm font-extrabold text-foreground">
        <Palette size={16} />
        Style &amp; Look
      </div>
      <div className="grid gap-1.5 text-xs">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-extrabold text-muted-foreground">Art style</span>
          <span className="font-extrabold text-foreground">
            {artStyle?.displayName ?? reel.artStyleId ?? "Auto (rotate)"}
          </span>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-extrabold text-muted-foreground">Motion</span>
          <span className="font-bold capitalize text-foreground">{motionLabel}</span>
        </div>
        {reel.captionStyle?.fontName ? (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-extrabold text-muted-foreground">Caption font</span>
            <span className="font-bold text-foreground">{reel.captionStyle.fontName}</span>
          </div>
        ) : null}
      </div>
      {artStyle?.thumbnailUrl ? (
        <img
          src={artStyle.thumbnailUrl}
          alt={artStyle.displayName}
          className="aspect-square w-20 rounded-md border border-border object-cover"
        />
      ) : null}
    </div>
  );
}

function StoryFlowPanel({ reel }: { reel?: Reel }) {
  if (!reel) {
    return (
      <div className="rounded-lg border border-border bg-muted/35 p-3 text-xs font-semibold text-muted-foreground">
        Select a reel to inspect story sourcing and generation flow.
      </div>
    );
  }

  const isReddit = reel.niche === "reddit" || Boolean(reel.redditStory);
  const isHorror = reel.niche.startsWith("horror") || Boolean(reel.storyBible || reel.horrorReference);
  if (!isReddit && !isHorror) return null;

  return (
    <div className="grid gap-2.5 rounded-lg border border-border bg-muted/25 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-extrabold text-foreground">
          <GitBranch size={16} />
          Story Flow
        </span>
        <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
          {isReddit ? "Reddit" : "AI horror"}
        </span>
      </div>

      <div className="grid gap-2">
        {isReddit ? <RedditStoryFlow reel={reel} /> : null}
        {isHorror ? <HorrorStoryFlow reel={reel} /> : null}
      </div>
    </div>
  );
}

function RedditStoryFlow({ reel }: { reel: Reel }) {
  const story = reel.redditStory;
  const source = story?.source ?? reel.storySource ?? reel.source ?? "auto";
  const part =
    (story?.partCount ?? reel.partCount ?? 1) > 1
      ? `Part ${story?.partNumber ?? reel.partNumber ?? 1} of ${story?.partCount ?? reel.partCount}`
      : "Single reel";
  return (
    <>
      <FlowStep
        icon={<FileText size={15} />}
        label="Source mode"
        value={`${source} · ${part}`}
        detail={story?.subreddit ? `${story.subreddit}${story.author ? ` · u/${story.author}` : ""}` : reel.genre ?? "Reddit story"}
        state={story ? "done" : reel.status === "planning" ? "active" : "pending"}
      />
      <FlowStep
        icon={<ShieldCheck size={15} />}
        label="Reuse guard"
        value={story?.seedUrl ? "Mongo checked active reel seed URLs" : "Waiting for Reddit seed URL"}
        detail={story?.seedTitle ?? story?.title ?? "The same Reddit seed is skipped until its reel is deleted."}
        href={story?.seedUrl}
        state={story?.seedUrl ? "done" : "pending"}
      />
      <FlowStep
        icon={<GitBranch size={15} />}
        label="Thread resolver"
        value={source === "verbatim" ? "Post body + OP updates + later author posts" : "Generated or rewritten from selected source"}
        detail={
          source === "verbatim"
            ? "If updates exist, they are combined before multipart splitting."
            : "Hybrid/LLM modes use the source as inspiration, not verbatim narration."
        }
        state={story ? "done" : "pending"}
      />
      <FlowStep
        icon={<UserCircle size={15} />}
        label="Narration voice"
        value={voiceLabel(reel)}
        detail={
          reel.voiceOverride
            ? "Custom voice was checked against the inferred narrator before render."
            : "Backend auto-matched the voice from the selected/generated story."
        }
        state={reel.narrationVoice ? "done" : reel.status === "planning" ? "active" : "pending"}
      />
      <FlowStep
        icon={<Clapperboard size={15} />}
        label="Render path"
        value={reel.status === "completed" ? "Rendered with gameplay, captions, outro, and review package" : `${reel.status} · ${reel.progress}%`}
        detail={reel.gameplayKey ? `Gameplay: ${reel.gameplayKey}` : "Gameplay clip is recorded once selected."}
        state={reel.status === "completed" ? "done" : reel.status === "failed" ? "blocked" : "active"}
      />
    </>
  );
}

function HorrorStoryFlow({ reel }: { reel: Reel }) {
  const bible = reel.storyBible;
  const reference = reel.horrorReference;
  return (
    <>
      <FlowStep
        icon={<BookOpen size={15} />}
        label="Reference chosen"
        value={reference ? reference.title : "No reference attached yet"}
        detail={
          reference
            ? `${reference.author ? `${reference.author} · ` : ""}${reference.license ?? "unknown license"}`
            : "The planner will use a scraped public-domain reference when one is available."
        }
        href={reference?.sourceUrl}
        state={reference ? "done" : reel.status === "planning" ? "active" : "pending"}
      />
      <FlowStep
        icon={<ShieldCheck size={15} />}
        label="Reuse guard"
        value={reference ? "Mongo checked active reel reference URLs" : "Waiting for selected reference"}
        detail="The same reference is skipped until the reel using it is deleted."
        state={reference ? "done" : "pending"}
      />
      <FlowStep
        icon={<Sparkles size={15} />}
        label="Story bible"
        value={bible?.premise ?? "Not planned yet"}
        detail={bible ? `Anchor: ${bible.anchorObject} · Rule: ${bible.impossibleRule}` : "Pass one creates premise, anchor object, rule, escalation, and twist."}
        state={bible ? "done" : reel.status === "planning" ? "active" : "pending"}
      />
      {bible?.escalation?.length ? (
        <div className="grid gap-1 rounded-md border border-border bg-background/65 p-2.5">
          <span className="text-[11px] font-extrabold uppercase tracking-normal text-muted-foreground">
            Escalation ladder
          </span>
          <div className="grid gap-1">
            {bible.escalation.slice(0, 5).map((beat, index) => (
              <div key={`${index}-${beat}`} className="grid grid-cols-[18px_1fr] gap-1.5 text-xs leading-snug">
                <span className="font-extrabold text-primary">{index + 1}</span>
                <span className="text-muted-foreground">{beat}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <FlowStep
        icon={<Image size={15} />}
        label="Visual/audio path"
        value={reel.status === "completed" ? "Scenes, voice, captions, horror mix, and review package complete" : `${reel.status} · ${reel.progress}%`}
        detail={[
          reel.artStyleId ? `Art: ${reel.artStyleId}` : undefined,
          reel.motionMode ? `Motion: ${reel.motionMode}` : undefined,
          reel.horrorAudioKey ? `Audio bed: ${reel.horrorAudioKey}` : undefined,
        ]
          .filter(Boolean)
          .join(" · ") || "Art, motion, and audio choices appear after planning."}
        state={reel.status === "completed" ? "done" : reel.status === "failed" ? "blocked" : "active"}
      />
      <FlowStep
        icon={<UserCircle size={15} />}
        label="Narration voice"
        value={voiceLabel(reel)}
        detail={reel.voiceOverride ? "Custom voice selected at creation." : "Resolved from niche/tier defaults."}
        state={reel.narrationVoice ? "done" : reel.status === "planning" ? "active" : "pending"}
      />
    </>
  );
}

function voiceLabel(reel: Reel): string {
  const voice = reel.narrationVoice ?? reel.voiceOverride;
  if (!voice?.voice && !voice?.model) return "Not resolved yet";
  return `${voice.model ?? "default model"} / ${voice.voice ?? "default voice"}`;
}

function FlowStep({
  icon,
  label,
  value,
  detail,
  href,
  state,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
  href?: string;
  state: "pending" | "active" | "done" | "blocked";
}) {
  return (
    <div className="grid grid-cols-[28px_1fr] gap-2 rounded-md border border-border bg-background/70 p-2.5">
      <div
        className={cn(
          "grid h-7 w-7 place-items-center rounded-full",
          state === "done" && "bg-success/20 text-success-foreground",
          state === "active" && "bg-warning/20 text-warning",
          state === "pending" && "bg-muted text-muted-foreground",
          state === "blocked" && "bg-destructive/15 text-destructive"
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-normal text-muted-foreground">
            {label}
          </span>
          {href ? (
            <a href={href} target="_blank" rel="noreferrer" className="shrink-0 text-primary">
              <ExternalLink size={13} />
            </a>
          ) : null}
        </div>
        <div className="break-words text-xs font-extrabold leading-snug text-foreground">{value}</div>
        {detail ? <div className="mt-1 break-words text-xs leading-snug text-muted-foreground">{detail}</div> : null}
      </div>
    </div>
  );
}
