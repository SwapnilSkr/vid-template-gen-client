import {
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  ExternalLink,
  GitBranch,
  Image as ImageIcon,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  UserCircle,
  X,
  Youtube,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  type Reel,
  type ReelReview,
} from "@/api/reels";
import { StyleLookPanel } from "@/components/review/StyleLookPanel";
import { StoryFlowPanel } from "@/components/review/StoryFlowPanel";
import { thumbnailPublishMessage } from "@/components/review/utils";
import { Button, buttonClassName } from "@/components/ui/button";
import {
  ConfirmDialog,
  type ConfirmDialogAction,
} from "@/components/ui/confirm-dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelTitle, panelClassName } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { useReelStudio } from "@/store/reel-studio";
import { reelId, reelTopStatus } from "@/utils/reel";
import { sanitizeAiCostBreakdown } from "@/utils/reel-cost";

interface ReviewInspectorProps {
  reel?: Reel;
  review?: ReelReview;
  selectedId?: string;
}

type InspectorPanel = "review" | "thumbnail" | "publish" | "details";

export function ReviewInspector({
  reel,
  review,
  selectedId,
}: ReviewInspectorProps) {
  return (
    <ReviewInspectorForm
      key={selectedId ?? "none"}
      reel={reel}
      review={review}
    />
  );
}

function ReviewInspectorForm({
  reel,
  review,
}: Omit<ReviewInspectorProps, "selectedId">) {
  const loading = useReelStudio((state) => state.loading);
  const saveReview = useReelStudio((state) => state.saveReview);
  const approveReview = useReelStudio((state) => state.approveReview);
  const publish = useReelStudio((state) => state.publish);
  const deleteSelected = useReelStudio((state) => state.deleteSelected);
  const youtubeChannels = useReelStudio((state) => state.youtubeChannels);
  const loadYouTubeChannels = useReelStudio(
    (state) => state.loadYouTubeChannels,
  );
  const connectYouTubeChannel = useReelStudio(
    (state) => state.connectYouTubeChannel,
  );
  const removeYouTubeChannel = useReelStudio(
    (state) => state.removeYouTubeChannel,
  );

  const [draft, setDraft] = useState<ReelReview | undefined>(review);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [showChannelConnect, setShowChannelConnect] = useState(false);
  const [newChannelLabel, setNewChannelLabel] = useState("");
  const [newChannelPrivacy, setNewChannelPrivacy] = useState<
    "private" | "unlisted" | "public"
  >("public");
  const [newChannelPreset, setNewChannelPreset] = useState<
    "reddit" | "horror" | "both"
  >("reddit");
  const [channelConnectMessage, setChannelConnectMessage] = useState("");
  const [hasUnsavedReviewEdits, setHasUnsavedReviewEdits] = useState(false);
  const [activePanel, setActivePanel] = useState<InspectorPanel>("review");
  const [costExpanded, setCostExpanded] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    ConfirmDialogAction | undefined
  >();
  const tagsText = useMemo(() => draft?.tags.join(", ") ?? "", [draft?.tags]);
  const selectedChannel = useMemo(
    () => youtubeChannels.find((channel) => channel.id === selectedChannelId),
    [selectedChannelId, youtubeChannels],
  );

  useEffect(() => {
    if (!hasUnsavedReviewEdits) setDraft(review);
  }, [hasUnsavedReviewEdits, review]);

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
          setChannelConnectMessage(
            event.data.message ?? "YouTube channel connected.",
          );
        } else {
          setChannelConnectMessage(
            event.data.message ??
              "Google did not grant access. Start again and approve the requested YouTube permissions.",
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
          : [
              "reddit",
              "reddit_stories",
              "aita",
              "horror",
              "horror_comic",
              "analog_horror",
            ];
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
  const costBreakdown = sanitizeAiCostBreakdown(reel?.costBreakdown);
  const youtubeStatus = reel?.youtube?.status;
  const publishInFlight =
    youtubeStatus === "pending" || youtubeStatus === "uploading";
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

  async function saveDraftReview(
    nextDraft = draft,
  ): Promise<ReelReview | undefined> {
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

  async function commitReviewBeforePublish() {
    if (hasUnsavedReviewEdits) await saveDraftReview();
  }

  async function publishDraftReview() {
    await commitReviewBeforePublish();
    await publish(selectedChannelId || undefined);
  }

  function channelName(channel: (typeof youtubeChannels)[number]) {
    return channel.googleChannelTitle || channel.label;
  }

  function channelHandle(channel: (typeof youtubeChannels)[number]) {
    return channel.googleChannelHandle
      ? channel.googleChannelHandle.replace(/^@?/, "@")
      : channel.googleChannelId
        ? `ID ${channel.googleChannelId}`
        : channel.source === "env"
          ? "Server default"
          : "Connected account";
  }

  function channelPurpose(channel: (typeof youtubeChannels)[number]) {
    const niches = channel.niches ?? [];
    if (niches.some((niche) => niche.startsWith("horror"))) return "Horror";
    if (niches.some((niche) => niche.startsWith("reddit") || niche === "aita"))
      return "Reddit";
    return channel.isDefault ? "Default" : "General";
  }

  const tabs: { id: InspectorPanel; label: string; icon: ReactNode }[] = [
    { id: "review", label: "Review", icon: <CheckCircle2 size={14} /> },
    { id: "thumbnail", label: "Thumb", icon: <ImageIcon size={14} /> },
    { id: "publish", label: "Publish", icon: <Youtube size={14} /> },
    { id: "details", label: "Details", icon: <GitBranch size={14} /> },
  ];

  return (
    <>
      <aside
        className={cn(
          panelClassName,
          "grid min-w-0 overflow-hidden xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)]",
        )}
      >
        <div className="grid gap-3 border-b border-border/70 bg-black/10 p-3.5">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <PanelTitle>Review Package</PanelTitle>
            <span className="shrink-0 rounded-full bg-warning px-2.5 py-1 text-xs font-semibold text-warning-foreground">
              {reelTopStatus(reel, draft)}
            </span>
          </div>

          {reel ? (
            <Link
              to="/studio/$id"
              params={{ id: reelId(reel) }}
              className={cn(
                buttonClassName("outline"),
                "w-full",
                reel.status === "plan_review" &&
                  "border-warning/50 text-warning",
              )}
            >
              <Sparkles size={16} />
              {reel.status === "plan_review"
                ? "Review plan in Studio"
                : "Open in Studio"}
            </Link>
          ) : null}

          <div className="grid grid-cols-4 gap-1 rounded-md border border-border bg-background/35 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={cn(
                  "inline-flex min-h-8 min-w-0 items-center justify-center gap-1 rounded px-1.5 text-xs font-semibold text-muted-foreground transition",
                  activePanel === tab.id &&
                    "bg-primary text-primary-foreground shadow-sm",
                )}
                onClick={() => setActivePanel(tab.id)}
              >
                {tab.icon}
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid max-h-[calc(100vh-15rem)] min-w-0 content-start gap-3 overflow-y-auto overflow-x-hidden p-3.5">
          {activePanel === "review" ? (
            <>
              <Label>
                Title
                <Input
                  value={draft?.title ?? ""}
                  disabled={!completed}
                  maxLength={100}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
                <small className="justify-self-end text-xs text-muted-foreground">
                  {draft?.title?.length ?? 0}/100
                </small>
              </Label>

              <Label>
                Description
                <Textarea
                  value={draft?.description ?? ""}
                  disabled={!completed}
                  rows={5}
                  maxLength={5000}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
                <small className="justify-self-end text-xs text-muted-foreground">
                  {draft?.description?.length ?? 0}/5,000
                </small>
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
                      tags: event.target.value
                        .split(",")
                        .map((tag) => tag.trim()),
                    }))
                  }
                />
              </Label>

              <div className="rounded-lg bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                {draft?.visibilityNotes ??
                  "Visibility guidance appears after the reel finishes."}
              </div>

              <Label>
                Publish Status
                <Select
                  disabled={!completed}
                  value={draft?.status ?? "draft"}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      status: event.target.value as ReelReview["status"],
                    }))
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="ready">In Review</option>
                  <option value="approved">Approved</option>
                </Select>
              </Label>

              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canReview}
                  onClick={() => void saveDraftReview()}
                >
                  <RefreshCw size={16} />
                  {hasUnsavedReviewEdits ? "Save Changes" : "Saved"}
                </Button>
                <Button
                  type="button"
                  variant="default"
                  disabled={!canReview}
                  onClick={() => void approveDraftReview()}
                >
                  <CheckCircle2 size={16} />
                  Approve
                </Button>
              </div>
            </>
          ) : null}

          {activePanel === "thumbnail" ? (
            <div className="grid min-w-0 gap-2.5">
              {draft?.thumbnailUrl ? (
                <img
                  className="aspect-video w-full rounded-lg border border-border object-cover"
                  src={draft.thumbnailUrl}
                  alt="Reviewed thumbnail"
                />
              ) : (
                <div className="grid aspect-video w-full place-items-center gap-2 rounded-lg border border-border bg-muted text-[13px] font-medium text-muted-foreground">
                  <ImageIcon size={22} />
                  Thumbnail appears after render
                </div>
              )}

              <div className="grid gap-2 rounded-md border border-border bg-muted/35 p-2.5">
                <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                  Thumbnail editing lives in the dedicated Thumbnail Studio — frame grabs, scene stills, text overlay, aspect ratio, and drafts stay separate from publishing.
                </p>
                {reel ? (
                  <Link
                    to="/studio/$id/thumbnail"
                    params={{ id: reel._id ?? reel.id ?? "" }}
                    search={{ mode: undefined }}
                    className={buttonClassName("default")}
                  >
                    <Sparkles size={16} />
                    Open Thumbnail Studio
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {activePanel === "publish" ? (
            <>
              <div className="grid gap-2.5 rounded-lg border border-border bg-black/15 p-3">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Youtube size={17} />
                    YouTube Publishing
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {youtubeChannels.length} channel
                    {youtubeChannels.length === 1 ? "" : "s"}
                  </span>
                </div>

                <Label>
                  Publish destination
                  <Select
                    disabled={
                      !completed ||
                      publishInFlight ||
                      youtubeChannels.length === 0
                    }
                    value={selectedChannelId}
                    onChange={(event) =>
                      setSelectedChannelId(event.target.value)
                    }
                  >
                    {youtubeChannels.length === 0 ? (
                      <option value="">No connected channel</option>
                    ) : (
                      youtubeChannels.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          {channelName(channel)} · {channelPurpose(channel)} ·{" "}
                          {channel.privacyStatus}
                        </option>
                      ))
                    )}
                  </Select>
                </Label>

                {selectedChannel ? (
                  <div className="flex min-w-0 items-center gap-3 rounded-md border border-border bg-card/70 p-2.5">
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
                      <div className="truncate text-sm font-semibold text-foreground">
                        {channelName(selectedChannel)}
                      </div>
                      <div className="truncate text-xs font-semibold text-muted-foreground">
                        {channelHandle(selectedChannel)}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {channelPurpose(selectedChannel)}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {selectedChannel.privacyStatus}
                        </span>
                        {selectedChannel.source === "env" ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
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

                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    Channel Accounts
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowChannelConnect((current) => !current)}
                    title={
                      showChannelConnect
                        ? "Close add channel"
                        : "Add YouTube channel"
                    }
                  >
                    {showChannelConnect ? <X size={16} /> : <Plus size={16} />}
                    {showChannelConnect ? "Close" : "Add Channel"}
                  </Button>
                </div>

                {showChannelConnect ? (
                  <div className="grid gap-2 rounded-md border border-border bg-card/70 p-2.5">
                    <Label>
                      Internal nickname
                      <Input
                        value={newChannelLabel}
                        placeholder="Example: Horror Main"
                        onChange={(event) =>
                          setNewChannelLabel(event.target.value)
                        }
                      />
                      <small className="text-xs text-muted-foreground">
                        Only used inside this app. The real YouTube name and
                        logo are pulled from Google after connect.
                      </small>
                    </Label>
                    <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                      <Label>
                        Content type
                        <Select
                          value={newChannelPreset}
                          onChange={(event) =>
                            setNewChannelPreset(
                              event.target.value as
                                | "reddit"
                                | "horror"
                                | "both",
                            )
                          }
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
                            setNewChannelPrivacy(
                              event.target.value as
                                | "private"
                                | "unlisted"
                                | "public",
                            )
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
                      <p className="text-xs font-semibold text-warning">
                        {channelConnectMessage}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {channelPresetHelp} Pick the Google account that owns
                        the channel, then approve YouTube upload and channel
                        read access.
                      </p>
                    )}
                  </div>
                ) : null}

                {youtubeChannels.filter(
                  (channel) => channel.source === "database",
                ).length > 0 ? (
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
                              <div className="truncate font-semibold text-foreground">
                                {channelName(channel)}
                              </div>
                              <div className="truncate font-semibold text-muted-foreground">
                                {channel.label} · {channelPurpose(channel)} ·{" "}
                                {channel.privacyStatus}
                              </div>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Remove channel"
                            disabled={loading}
                            onClick={() =>
                              void removeYouTubeChannel(channel.id)
                            }
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
                {publishInFlight ? (
                  <Loader2 className="animate-spin" size={17} />
                ) : (
                  <Send size={17} />
                )}
                {publishButtonLabel}
              </Button>

              {reel?.youtube ? (
                <div
                  className={cn(
                    "rounded-lg border px-3 py-2 text-xs leading-relaxed",
                    reel.youtube.status === "failed"
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-border bg-muted/40 text-muted-foreground",
                  )}
                >
                  <div className="font-medium text-foreground">
                    YouTube:{" "}
                    {reel.youtube.status === "pending"
                      ? "Queued"
                      : reel.youtube.status}
                  </div>
                  {reel.youtube.channelLabel || reel.youtube.channelId ? (
                    <div>
                      Channel:{" "}
                      {reel.youtube.channelLabel ?? reel.youtube.channelId}
                    </div>
                  ) : null}
                  {reel.youtube.error ? <div>{reel.youtube.error}</div> : null}
                  {reel.youtube.thumbnailStatus ? (
                    <div>
                      Thumbnail:{" "}
                      {reel.youtube.thumbnailStatus === "uploaded"
                        ? "custom image uploaded"
                        : reel.youtube.thumbnailStatus === "failed"
                          ? "not uploaded"
                          : reel.youtube.thumbnailStatus}
                    </div>
                  ) : null}
                  {reel.youtube.shortsCoverStatus ? (
                    <div>
                      Shorts cover:{" "}
                      {reel.youtube.shortsCoverStatus === "applied"
                        ? "vertical shelf updated"
                        : reel.youtube.shortsCoverStatus === "unchanged"
                          ? "auto frame kept — set cover in YouTube Studio"
                          : "unverified"}
                    </div>
                  ) : null}
                  {reel.youtube.thumbnailError ? (
                    <div>
                      {thumbnailPublishMessage(reel.youtube.thumbnailError)}
                    </div>
                  ) : null}
                  {reel.youtube.publishedAt ? (
                    <div>
                      Published{" "}
                      {new Date(reel.youtube.publishedAt).toLocaleString()}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {reel ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={loading}
                  onClick={() =>
                    setConfirmAction({
                      title: "Delete reel and assets?",
                      body: "Delete this reel and its recorded S3 assets.",
                      details: [
                        "Global gameplay clips and voice samples will not be touched.",
                      ],
                      confirmLabel: "Delete reel",
                      variant: "destructive",
                      onConfirm: () => deleteSelected(),
                    })
                  }
                >
                  <Trash2 size={17} />
                  Delete Reel + Assets
                </Button>
              ) : null}

              {reel?.youtube?.url ? (
                <a
                  className="text-center text-[13px] font-medium text-primary no-underline"
                  href={reel.youtube.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="inline align-[-2px]" size={14} />{" "}
                  Open published Short
                </a>
              ) : null}
            </>
          ) : null}

          {activePanel === "details" ? (
            <>
              <StoryFlowPanel reel={reel} />

              <StyleLookPanel reel={reel} />

              {costBreakdown ? (
                <div className="grid gap-2 rounded-lg border border-border bg-muted/40 p-3">
                  <button
                    type="button"
                    onClick={() => setCostExpanded(!costExpanded)}
                    className="flex w-full items-center justify-between gap-3 text-left focus:outline-none cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                      <ReceiptText size={16} />
                      Generation Cost
                      <ChevronDown
                        size={14}
                        className={cn(
                          "text-muted-foreground transition-transform duration-200",
                          costExpanded && "rotate-180",
                        )}
                      />
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      ${costBreakdown.totalUsd.toFixed(4)}
                    </span>
                  </button>
                  {costExpanded ? (
                    <>
                      <div className="grid gap-1.5 pt-2 border-t border-border/50">
                        {costBreakdown.lines.map((line) => (
                          <div
                            key={`${line.label}-${line.model ?? line.unit}`}
                            className="grid gap-0.5 text-xs"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium text-foreground">
                                {line.label}
                              </span>
                              <span className="font-medium text-foreground">
                                ${line.costUsd.toFixed(4)}
                              </span>
                            </div>
                            <span className="truncate text-muted-foreground">
                              {line.units} {line.unit} x $
                              {line.unitCostUsd.toFixed(5)}
                              {line.model ? ` · ${line.model}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                      {costBreakdown.note ? (
                        <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                          {costBreakdown.note}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </aside>
      <ConfirmDialog
        action={confirmAction}
        busy={loading}
        onClose={() => setConfirmAction(undefined)}
      />
    </>
  );
}
