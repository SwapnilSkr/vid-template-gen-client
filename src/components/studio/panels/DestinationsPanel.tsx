import { Link } from "@tanstack/react-router";
import { AtSign, ChevronDown, Crown, Facebook, Plus, RefreshCw, Sparkles, Trash2, Youtube } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addReelDestination,
  listFacebookPages,
  listInstagramChannels,
  listThreadsChannels,
  listYouTubeChannels,
  mediaUrl,
  regenerateOutroCommentPrompt,
  regenerateReel,
  retryReelOutro,
  removeReelDestination,
  setReelPrimaryDestination,
  updateReelDestinationOutro,
  updateReelSettings,
  type InstagramChannelOption,
  type FacebookPageOption,
  type OutroSettings,
  type Reel,
  type ReelDestination,
  type ThreadsChannelOption,
  type YouTubeChannelOption,
} from "@/api/reels";
import { OutroIncludeToggles } from "@/components/studio/panels/OutroIncludeToggles";
import { StudioDialog } from "@/components/studio/StudioDialog";
import type { ConfirmAction, StudioRun } from "@/components/studio/types";
import {
  channelDisplayName,
  compactOutroSettings,
  DEFAULT_OUTRO_COMMENT_PROMPT,
  defaultOutroCta,
  defaultOutroSpokenLine,
} from "@/components/studio/utils";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelTitle } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { canOutroOnlyRerender, REEL_ACTIVE_STATUSES } from "@/utils/reel";

type Platform = "youtube" | "instagram" | "facebook" | "threads";
type PrimaryPlatform = Extract<Platform, "youtube" | "instagram">;
type PromptScope = "primary" | "inheriting" | "all";
type PrimaryScope = "reel" | "series";

type ChannelChoice = {
  key: string;
  platform: Platform;
  channelId: string;
  label: string;
  disabled?: boolean;
  note?: string;
};

type OutroControlTarget = {
  value: string;
  label: string;
  scope: "primary" | "destination";
  destinationId?: string;
};

const statusTone: Record<ReelDestination["status"], string> = {
  ready: "text-emerald-500",
  rendering: "text-amber-500",
  pending: "text-muted-foreground/70",
  failed: "text-destructive",
};

function primaryPlatform(reel: Reel): PrimaryPlatform {
  return reel.outroInstagramChannelId ? "instagram" : "youtube";
}

function primaryChannelId(reel: Reel): string {
  return reel.outroInstagramChannelId || reel.outroChannelId || "";
}

function promptScopeLabel(scope: PromptScope): string {
  if (scope === "primary") return "Primary only";
  if (scope === "all") return "Every channel draft";
  return "Primary + channels using story default";
}

/** One destination-first workspace. The story question is global; account card
 * fields stay with their channel, so output/publish ownership is obvious. */
function DestinationManager({
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
  const brandedEnabled = !reel.skipBrandedOutro;
  const canRerenderDestination = brandedEnabled && Boolean(reel.bodyVideoUrl) &&
    (reel.scenes?.length ?? 0) > 0 &&
    !REEL_ACTIVE_STATUSES.includes(reel.status);
  const extras = useMemo(() => reel.destinations ?? [], [reel.destinations]);
  const [yt, setYt] = useState<YouTubeChannelOption[]>([]);
  const [ig, setIg] = useState<InstagramChannelOption[]>([]);
  const [facebook, setFacebook] = useState<FacebookPageOption[]>([]);
  const [threads, setThreads] = useState<ThreadsChannelOption[]>([]);
  const [crossPostLoadError, setCrossPostLoadError] = useState<string>();
  const [addValue, setAddValue] = useState("");
  const [addScope, setAddScope] = useState<PrimaryScope>("reel");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, OutroSettings>>({});
  const [primaryDraft, setPrimaryDraft] = useState<OutroSettings>(reel.outro ?? {});
  const [storyQuestion, setStoryQuestion] = useState(reel.outro?.commentPrompt ?? "");
  const [promptScope, setPromptScope] = useState<PromptScope>("inheriting");
  const [primaryTarget, setPrimaryTarget] = useState("");
  const [primaryScope, setPrimaryScope] = useState<PrimaryScope>("reel");
  const [removalNotice, setRemovalNotice] = useState<string>();
  const primaryDraftDirty = useRef(false);
  const questionDirty = useRef(false);

  useEffect(() => {
    void Promise.allSettled([
      listYouTubeChannels(),
      listInstagramChannels(),
      listFacebookPages(),
      listThreadsChannels(),
    ]).then(([a, b, fb, th]) => {
      setYt(a.status === "fulfilled" ? a.value : []);
      setIg(b.status === "fulfilled" ? b.value : []);
      setFacebook(fb.status === "fulfilled" ? fb.value : []);
      setThreads(th.status === "fulfilled" ? th.value : []);
      const failure = fb.status === "rejected" ? fb.reason : th.status === "rejected" ? th.reason : undefined;
      setCrossPostLoadError(failure instanceof Error ? failure.message : undefined);
    });
  }, []);

  useEffect(() => {
    if (!primaryDraftDirty.current) setPrimaryDraft(reel.outro ?? {});
    if (!questionDirty.current) setStoryQuestion(reel.outro?.commentPrompt ?? "");
  }, [reel.outro]);

  const currentPrimaryPlatform = primaryPlatform(reel);
  const currentPrimaryChannelId = primaryChannelId(reel);
  const currentPrimaryKey = `${currentPrimaryPlatform}:${currentPrimaryChannelId}`;
  const channels = useMemo<ChannelChoice[]>(() => [
    ...yt.map((channel) => ({
      key: `youtube:${channel.id}`,
      platform: "youtube" as const,
      channelId: channel.id,
      label: `YouTube · ${channelDisplayName(channel)}`,
    })),
    ...ig.map((channel) => ({
      key: `instagram:${channel.id}`,
      platform: "instagram" as const,
      channelId: channel.id,
      label: `Instagram · ${channel.username ? `@${channel.username}` : channel.label}`,
    })),
    ...facebook.map((page) => ({
      key: `facebook:${page.id}`,
      platform: "facebook" as const,
      channelId: page.id,
      label: `Facebook Page · ${page.name || page.label}`,
    })),
    ...threads.map((channel) => ({
      key: `threads:${channel.id}`,
      platform: "threads" as const,
      channelId: channel.id,
      label: `Threads · ${channel.username ? `@${channel.username}` : channel.name || channel.label}`,
    })),
  ], [yt, ig, facebook, threads]);
  const channelLabelByKey = useMemo(
    () => new Map(channels.map((channel) => [channel.key, channel.label])),
    [channels],
  );
  const currentPrimaryLabel = currentPrimaryChannelId
    ? channelLabelByKey.get(currentPrimaryKey) ?? currentPrimaryChannelId
    : "Choose a primary account";
  const usedExtraKeys = useMemo(
    () => new Set(extras.map((destination) => `${destination.platform}:${destination.channelId}`)),
    [extras],
  );
  const addOptions = useMemo(
    () => channels
      .map((channel) => {
        if (channel.key === currentPrimaryKey) return { ...channel, disabled: true, note: "already primary" };
        if (usedExtraKeys.has(channel.key)) return { ...channel, disabled: true, note: "already added" };
        return channel;
      })
      .sort((a, b) => Number(a.disabled ?? false) - Number(b.disabled ?? false)),
    [channels, currentPrimaryKey, usedExtraKeys],
  );
  const hasSelectableExtra = addOptions.some((option) => !option.disabled);
  // Do not preselect the current primary as a supposed replacement. That made
  // the destructive-looking actions disabled with no explanation and left the
  // creator guessing what they had done wrong.
  const primaryOptions = useMemo<Array<ChannelChoice & { platform: PrimaryPlatform }>>(
    () => channels.filter((channel): channel is ChannelChoice & { platform: PrimaryPlatform } =>
      channel.key !== currentPrimaryKey && (channel.platform === "youtube" || channel.platform === "instagram"),
    ),
    [channels, currentPrimaryKey],
  );
  const selectedPrimary = primaryOptions.find((channel) => channel.key === primaryTarget);
  const primaryChanged = Boolean(selectedPrimary);

  const draftFor = (destination: ReelDestination): OutroSettings =>
    drafts[destination.id] ?? destination.outro ?? {};
  const patchDraft = (id: string, patch: Partial<OutroSettings>) =>
    setDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? extras.find((item) => item.id === id)?.outro ?? {}), ...patch },
    }));
  const patchPrimaryDraft = (patch: Partial<OutroSettings>) => {
    primaryDraftDirty.current = true;
    setPrimaryDraft((current) => ({ ...current, ...patch }));
  };

  const addChannel = () => {
    const choice = addOptions.find((option) => option.key === addValue);
    if (!choice || choice.disabled) return;
    const add = async () => {
      const result = await run(() => addReelDestination(reelKey, {
        platform: choice.platform,
        channelId: choice.channelId,
        scope: addScope,
      }));
      if (result.ok) setAddValue("");
      return result;
    };
    if (addScope === "series" && reel.seriesId) {
      requestConfirm({
        title: `Add ${choice.label} to every story part?`,
        body: "Each part gets its own channel-specific final output and branded outro for this account.",
        details: [
          "Parts that already have this extra destination are left unchanged.",
          "Ready parts render only the newly added outro over their cached shared body.",
          "Facebook/Threads get their own branded output only when you add them here; otherwise their publish flow keeps using the primary render.",
        ],
        confirmLabel: "Add to every part",
        costTone: "paid",
        onConfirm: add,
      });
      return;
    }
    void add();
  };

  const savePrimaryOutro = async (renderAfterSave = false) => {
    const result = await run(async () => {
      const next = await updateReelSettings(reelKey, {
        // The discussion question is owned by the global card, not by a
        // particular primary account. Saving account copy must not restore a
        // stale prompt from a polling snapshot.
        outro: compactOutroSettings({ ...primaryDraft, commentPrompt: storyQuestion }),
      });
      return renderAfterSave ? regenerateReel(reelKey, "outro_only") : next;
    });
    if (result.ok) {
      primaryDraftDirty.current = false;
      questionDirty.current = false;
    }
    return result;
  };

  const saveStoryQuestion = async () => {
    const result = await run(() => updateReelSettings(reelKey, {
      outro: compactOutroSettings({ ...(reel.outro ?? {}), commentPrompt: storyQuestion }),
    }));
    if (result.ok) questionDirty.current = false;
    return result;
  };

  const regenerateQuestion = async (renderOutro: boolean) =>
    run(async () => {
      if (questionDirty.current) {
        // Stay inside this one Studio action. Calling `saveStoryQuestion` here
        // would nest `run()` and can leave the busy/error state out of sync.
        await updateReelSettings(reelKey, {
          outro: compactOutroSettings({ ...(reel.outro ?? {}), commentPrompt: storyQuestion }),
        });
      }
      const next = await regenerateOutroCommentPrompt(reelKey, promptScope);
      setStoryQuestion(next.outro?.commentPrompt ?? "");
      questionDirty.current = false;
      return renderOutro ? regenerateReel(reelKey, "outro_only") : next;
    });

  const saveDestinationOutro = (destination: ReelDestination, draft: OutroSettings) =>
    run(async () => {
      const next = await updateReelDestinationOutro(reelKey, destination.id, compactOutroSettings(draft));
      setDrafts((current) => {
        const { [destination.id]: _saved, ...rest } = current;
        return rest;
      });
      return next;
    });

  const requestDestinationRemoval = (destination: ReelDestination) => {
    const label = destination.channelLabel || destination.channelId;
    const assetCount = Number(Boolean(destination.outputUrl)) + Number(Boolean(destination.outroAudioUrl));
    requestConfirm({
      title: `Remove ${label} from this reel?`,
      body: "This removes only this channel from this reel. The connected social account itself is not deleted.",
      details: [
        assetCount
          ? `${assetCount} recorded channel-specific ${assetCount === 1 ? "asset" : "assets"} will be deleted from S3.`
          : "This channel has no recorded final video or outro audio to delete.",
        "The primary account and every other channel remain unchanged.",
        "The result will report the S3 cleanup outcome here and in Operations.",
      ],
      confirmLabel: "Remove channel & reclaim media",
      variant: "destructive",
      costTone: "free",
      onConfirm: () => run(async () => {
        const next = await removeReelDestination(reelKey, destination.id);
        const result = next.lastDestinationRemoval;
        if (result?.cleanup.failed) {
          setRemovalNotice(`Removed ${label}, but ${result.cleanup.failed} S3 delete request${result.cleanup.failed === 1 ? "" : "s"} failed. See Operations for the affected cleanup warning.`);
        } else if (result?.cleanup.deleted) {
          setRemovalNotice(`Removed ${label}. S3 cleanup completed for ${result.cleanup.deleted} recorded ${result.cleanup.deleted === 1 ? "asset" : "assets"}.`);
        } else {
          setRemovalNotice(`Removed ${label}. No recorded S3 media needed deletion.`);
        }
        return next;
      }),
    });
  };

  const requestPrimaryChange = (previousPrimary: "keep" | "remove") => {
    if (!selectedPrimary || !primaryChanged) return;
    const seriesEligible = Boolean(reel.seriesId && (reel.partCount ?? 1) > 1);
    requestConfirm({
      title: previousPrimary === "remove" ? "Replace and reclaim the primary?" : "Make this the primary account?",
      body: previousPrimary === "remove"
        ? `Replace ${currentPrimaryLabel} with ${selectedPrimary.label}. The current primary's final video and outro audio are deleted only from ${primaryScope === "series" ? "every part in this story" : "this reel"}.`
        : `Make ${selectedPrimary.label} the primary publish account. ${currentPrimaryLabel} remains as an extra channel with its own correct final output.`,
      details: [
        "This never deletes or disconnects the connected social account itself.",
        primaryScope === "series" && seriesEligible
          ? "The routing change applies to every part in this story series."
          : "The routing change applies only to this reel part.",
        "Publishing always follows the selected account's own ready channel-specific video.",
      ],
      confirmLabel: previousPrimary === "remove" ? "Replace & reclaim media" : "Make primary",
      variant: previousPrimary === "remove" ? "destructive" : "default",
      costTone: "free",
      onConfirm: () => run(() => setReelPrimaryDestination(reelKey, {
        platform: selectedPrimary.platform,
        channelId: selectedPrimary.channelId,
        previousPrimary,
        scope: primaryScope,
      })),
    });
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-2.5">
        <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
          One story body, one required primary account, and dedicated branded outputs for every selected channel. Story discussion copy is global; account branding stays with its channel.
        </p>
        {!brandedEnabled ? (
          <p className="m-0 rounded border border-amber-500/25 bg-amber-500/[0.04] px-2.5 py-2 text-[11px] text-muted-foreground">
            Branded outro is off. You can still save its question and account-card copy now; it will be used when you enable the outro again. No outro render is queued while it stays off.
          </p>
        ) : null}
      </div>

      <section className="grid gap-2 rounded-md border border-primary/25 bg-primary/[0.035] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="grid gap-0.5">
            <span className="text-xs font-semibold text-foreground">Story discussion question</span>
            <span className="text-[11px] text-muted-foreground">Shown and spoken at the outro; it is not tied to a channel identity.</span>
          </div>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Global</span>
        </div>
        <Textarea
          rows={2}
          maxLength={160}
          disabled={busy}
          value={storyQuestion}
          placeholder="AI-generated for this exact story part"
          onChange={(event) => {
            questionDirty.current = true;
            setStoryQuestion(event.target.value);
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void saveStoryQuestion()}>
            Save question
          </Button>
          <Label className="min-w-[200px] flex-1 text-[11px] text-muted-foreground">
            Apply generated question to
            <Select value={promptScope} disabled={busy} onChange={(event) => setPromptScope(event.target.value as PromptScope)}>
              <option value="inheriting">Primary + channels using story default</option>
              <option value="primary">Primary only</option>
              <option value="all">Every channel draft</option>
            </Select>
          </Label>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => {
              const fast = !isPlanReview && brandedEnabled && canOutroOnlyRerender(reel);
              requestConfirm({
                title: fast ? "Regenerate question and affected outros?" : "Regenerate the story question?",
                body: fast
                  ? "The cheap LLM writes a fresh question for this exact story part, then renders only the affected channel outros over the cached body."
                  : "The cheap LLM writes a fresh question for this exact story part. No scene, gameplay, or body narration is changed.",
                details: [
                  `Scope: ${promptScopeLabel(promptScope)}.`,
                  "The LLM cost is added to this reel's cost breakdown immediately.",
                  fast
                    ? "Ready channels outside this scope stay untouched."
                    : isPlanReview
                      ? "This is copy-only until first production."
                      : "Use the channel render action after a body cache is available.",
                ],
                confirmLabel: fast ? "Regenerate & render affected outros" : "Regenerate question · AI",
                costTone: "paid",
                onConfirm: () => regenerateQuestion(fast),
              });
            }}
          >
            <Sparkles size={14} /> Regenerate question
          </Button>
        </div>
      </section>

      <section className="grid gap-2 rounded-md border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex min-w-0 items-center gap-1.5 truncate font-semibold text-foreground">
            <Crown size={14} className="text-primary" /> {currentPrimaryLabel}
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Primary</span>
          </span>
          <span className={cn("shrink-0 text-[11px]", reel.outputUrl ? statusTone.ready : statusTone.pending)}>
            {reel.outputUrl ? "ready" : "not rendered"}
          </span>
        </div>
        {reel.outputUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video key={reel.outputUrl} src={mediaUrl(reel.outputUrl)} controls preload="none" className="aspect-9/16 max-h-[38vh] w-full max-w-[220px] rounded-md border border-border bg-black" />
        ) : null}

        <Label className="text-[11px] text-muted-foreground">
          Replace this primary with another connected account
          <Select disabled={busy || !primaryOptions.length} value={primaryTarget} onChange={(event) => setPrimaryTarget(event.target.value)}>
            <option value="">{primaryOptions.length ? "Choose a replacement account…" : "No other connected account"}</option>
            <optgroup label="YouTube Shorts">
              {primaryOptions.filter((channel) => channel.platform === "youtube").map((channel) => <option key={channel.key} value={channel.key}>{channel.label}</option>)}
            </optgroup>
            <optgroup label="Instagram Reels">
              {primaryOptions.filter((channel) => channel.platform === "instagram").map((channel) => <option key={channel.key} value={channel.key}>{channel.label}</option>)}
            </optgroup>
          </Select>
        </Label>
        {!primaryOptions.length ? (
          <p className="m-0 rounded border border-border bg-background/60 px-2.5 py-2 text-[11px] text-muted-foreground">
            Connect another account before replacing or removing this primary. Every reel must keep one primary publish destination.
          </p>
        ) : !selectedPrimary ? (
          <p className="m-0 text-[11px] text-muted-foreground">
            Choose a replacement above. The current primary stays untouched until you confirm one of the two choices below.
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <Label className="min-w-[180px] flex-1 text-[11px] text-muted-foreground">
              Apply change to
              <Select value={primaryScope} disabled={busy || !reel.seriesId} onChange={(event) => setPrimaryScope(event.target.value as PrimaryScope)}>
                <option value="reel">This reel part</option>
                <option value="series">Every part in this story</option>
              </Select>
            </Label>
            <Button type="button" size="sm" variant="outline" disabled={busy || !primaryChanged} onClick={() => requestPrimaryChange("keep")}>
              Make primary · keep old
            </Button>
            <Button type="button" size="sm" variant="destructive" disabled={busy || !primaryChanged} onClick={() => requestPrimaryChange("remove")}>
              Replace & reclaim old media
            </Button>
          </div>
        )}

        <PrimaryOutroFields
          value={primaryDraft}
          platform={currentPrimaryPlatform}
          channelName={currentPrimaryLabel}
          busy={busy}
          onChange={patchPrimaryDraft}
          onSave={() => {
            if (!canRerenderDestination) {
              void savePrimaryOutro();
              return;
            }
            requestConfirm({
              title: "Save and render the primary outro?",
              body: "Only the primary account's branded outro is rebuilt over the cached shared story body.",
              details: [
                "Scene assets, gameplay, captions, and body narration are reused.",
                "A new outro TTS call is recorded only if the spoken copy changed.",
              ],
              confirmLabel: "Save & render primary outro",
              costTone: "paid",
              onConfirm: () => savePrimaryOutro(true),
            });
          }}
          saveLabel={canRerenderDestination ? "Save & render primary outro" : "Save primary account outro"}
        />
      </section>

      <section className="grid gap-2.5">
        <span className="text-xs font-semibold text-foreground">Additional channel outputs</span>
        {removalNotice ? (
          <p role="status" className="m-0 rounded border border-primary/25 bg-primary/[0.04] px-2.5 py-2 text-[11px] text-muted-foreground">
            {removalNotice}
          </p>
        ) : null}
        {extras.map((destination) => {
          const open = expanded === destination.id;
          const draft = draftFor(destination);
          const narrationChanged =
            !destination.outroAudioSignature ||
            (destination.outro?.commentPrompt ?? "") !== (draft.commentPrompt ?? "") ||
            (destination.outro?.spokenLine ?? "") !== (draft.spokenLine ?? "");
          return (
            <div key={destination.id} className="rounded-md border border-border bg-card">
              <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                <span className="min-w-0 truncate font-medium text-foreground">
                  {destination.channelLabel || destination.channelId}
                  <span className="ml-1.5 text-muted-foreground/60">· {destination.platform}</span>
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={cn("text-[11px]", statusTone[destination.status])}>{isPlanReview && destination.status === "pending" ? "planned" : destination.status}</span>
                  <button type="button" disabled={busy} title="Remove this channel from the reel and reclaim its channel-specific media" aria-label={`Remove ${destination.channelLabel ?? destination.channelId}`} onClick={() => requestDestinationRemoval(destination)} className="grid h-6 w-6 place-items-center rounded text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {destination.outputUrl ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video key={destination.outputUrl} src={mediaUrl(destination.outputUrl)} controls preload="none" className="mx-3 aspect-9/16 max-h-[38vh] w-[calc(100%-1.5rem)] max-w-[220px] rounded-md border border-border bg-black" />
              ) : null}
              <button type="button" onClick={() => setExpanded(open ? null : destination.id)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                Edit this channel's branded outro
                <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
              </button>
              {open ? (
                <ChannelOutroFields
                  value={draft}
                  platform={destination.platform}
                  channelName={destination.channelLabel || destination.channelId}
                  storyQuestion={storyQuestion || DEFAULT_OUTRO_COMMENT_PROMPT}
                  busy={busy}
                  onChange={(patch) => patchDraft(destination.id, patch)}
                  onSave={() => {
                    if (canRerenderDestination && narrationChanged) {
                      requestConfirm({
                        title: `Save & render ${destination.channelLabel ?? destination.channelId}?`,
                        body: "Only this account's branded outro is rebuilt over the shared cached story body.",
                        details: [
                          "The optional local question overrides the global story question only for this account.",
                          "A new outro TTS call is recorded only when its spoken copy changed.",
                        ],
                        confirmLabel: "Save & render this outro",
                        costTone: "paid",
                        onConfirm: () => saveDestinationOutro(destination, draft),
                      });
                      return;
                    }
                    void saveDestinationOutro(destination, draft);
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </section>

      <section className="grid gap-2 rounded-md border border-dashed border-border bg-background/30 p-3">
        <div className="grid gap-0.5">
          <span className="text-xs font-semibold text-foreground">Cross-post accounts</span>
          <span className="text-[11px] leading-relaxed text-muted-foreground">By default these cross-post the completed primary render. Add either one below only when it needs its own profile-card outro.</span>
        </div>
        {crossPostLoadError ? <p role="status" className="m-0 text-[11px] text-warning">Could not load every cross-post account: {crossPostLoadError}</p> : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <ConnectedPlatformSummary icon={<Facebook size={14} className="text-blue-600" />} title="Facebook Reels" accounts={facebook.map((page) => page.name || page.label)} empty="No Facebook Page connected" />
          <ConnectedPlatformSummary icon={<AtSign size={14} />} title="Threads" accounts={threads.map((channel) => channel.username ? `@${channel.username}` : channel.label)} empty="No Threads profile connected" />
        </div>
        <Link to="/accounts" className="justify-self-start text-[11px] font-medium text-primary underline-offset-2 hover:underline">Manage Facebook and Threads connections →</Link>
      </section>

      <section className="grid gap-2 rounded-md border border-dashed border-border px-3 py-2.5">
        <span className="text-[11px] font-semibold text-muted-foreground">Add a channel-specific outro output</span>
        <p className="m-0 text-[11px] text-muted-foreground/70">Each added account gets a platform-specific branded final. Leave Facebook/Threads unadded to keep their low-cost primary-render cross-post.</p>
        {addOptions.length === 0 ? <p className="m-0 text-[11px] text-muted-foreground/70">Connect a platform account first.</p> : (
          <div className="flex items-center gap-2">
            <Select disabled={busy} value={addValue} onChange={(event) => setAddValue(event.target.value)} className="min-w-0 flex-1">
              <option value="">{hasSelectableExtra ? "Choose a channel…" : "All connected channels are already assigned"}</option>
              <optgroup label="YouTube Shorts">
                {addOptions.filter((option) => option.platform === "youtube").map((option) => <option key={option.key} value={option.key} disabled={option.disabled}>{option.disabled ? `✓ ${option.label} — ${option.note}` : option.label}</option>)}
              </optgroup>
              <optgroup label="Instagram Reels">
                {addOptions.filter((option) => option.platform === "instagram").map((option) => <option key={option.key} value={option.key} disabled={option.disabled}>{option.disabled ? `✓ ${option.label} — ${option.note}` : option.label}</option>)}
              </optgroup>
              <optgroup label="Facebook Pages">
                {addOptions.filter((option) => option.platform === "facebook").map((option) => <option key={option.key} value={option.key} disabled={option.disabled}>{option.disabled ? `✓ ${option.label} — ${option.note}` : option.label}</option>)}
              </optgroup>
              <optgroup label="Threads profiles">
                {addOptions.filter((option) => option.platform === "threads").map((option) => <option key={option.key} value={option.key} disabled={option.disabled}>{option.disabled ? `✓ ${option.label} — ${option.note}` : option.label}</option>)}
              </optgroup>
            </Select>
            <Select value={addScope} disabled={busy || !reel.seriesId} onChange={(event) => setAddScope(event.target.value as PrimaryScope)} className="w-[145px] shrink-0">
              <option value="reel">This reel part</option>
              <option value="series">Every story part</option>
            </Select>
            <Button type="button" variant="outline" disabled={busy || !addValue} onClick={addChannel}><Plus size={14} /> Add</Button>
          </div>
        )}
        <p className="m-0 text-[11px] text-muted-foreground/70">
          {isPlanReview ? "Planned accounts receive their own branded output during first production." : addScope === "series" && reel.seriesId ? "Every story part receives this account's own branded output; ready parts reuse their cached body." : "Adding a channel after production renders only that account's outro over the cached body."}
        </p>
      </section>
    </div>
  );
}

export function DestinationManagerDialog({
  reel,
  busy,
  run,
  requestConfirm,
  onClose,
}: {
  reel: Reel;
  busy: boolean;
  run: StudioRun;
  requestConfirm: (action: ConfirmAction) => void;
  onClose: () => void;
}) {
  return (
    <StudioDialog
      title="Accounts & branded outros"
      description="Choose the primary and secondary accounts for this reel, then tailor each channel's outro. These changes affect this reel only."
      onClose={onClose}
    >
      <DestinationManager reel={reel} busy={busy} run={run} requestConfirm={requestConfirm} />
    </StudioDialog>
  );
}

function ConnectedPlatformSummary({
  icon,
  title,
  accounts,
  empty,
}: {
  icon: React.ReactNode;
  title: string;
  accounts: string[];
  empty: string;
}) {
  return (
    <div className="grid gap-1 rounded border border-border bg-card/60 p-2.5">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">{icon}{title}</span>
      {accounts.length ? (
        <span className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{accounts.join(" · ")}</span>
      ) : (
        <span className="text-[11px] text-muted-foreground/75">{empty}</span>
      )}
    </div>
  );
}

export function DestinationsPanel({
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
  const [open, setOpen] = useState(false);
  const [outroControlOpen, setOutroControlOpen] = useState(false);
  const destinationCount = 1 + (reel.destinations?.length ?? 0);
  const brandedEnabled = !reel.skipBrandedOutro;

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <PanelTitle className="inline-flex items-center gap-2 text-foreground">
          <Youtube size={15} className="text-primary" /> Destinations & outro
        </PanelTitle>
        <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
          Keep the inspector quiet: account routing and per-account branding open only when you need to change them.
        </p>
      </div>
      <OutroIncludeToggles reel={reel} busy={busy} run={run} requestConfirm={requestConfirm} />
      {!brandedEnabled ? (
        <p className="m-0 rounded border border-amber-500/25 bg-amber-500/[0.04] px-2.5 py-2 text-[11px] text-muted-foreground">
          Branded outro is off. Your saved account copy remains available when you enable it again.
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => setOutroControlOpen(true)}
        className="grid cursor-pointer gap-1 rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-primary/35 hover:bg-primary/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground"><RefreshCw size={14} className="text-primary" /> Outro control centre</span>
        <span className="text-[11px] leading-relaxed text-muted-foreground">Rebuild every outro or one account&apos;s card after a profile picture, name, handle, or card render issue — without re-voicing unchanged speech.</span>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid cursor-pointer gap-1 rounded-md border border-primary/25 bg-primary/[0.035] p-3 text-left transition-colors hover:bg-primary/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground"><Crown size={14} className="text-primary" /> Manage primary & secondary accounts</span>
        <span className="text-[11px] leading-relaxed text-muted-foreground">{destinationCount} assigned publish {destinationCount === 1 ? "account" : "accounts"} · add, remove, replace the primary, or edit channel-specific outro copy.</span>
      </button>
      {open ? <DestinationManagerDialog reel={reel} busy={busy} run={run} requestConfirm={requestConfirm} onClose={() => setOpen(false)} /> : null}
      {outroControlOpen ? <OutroControlDialog reel={reel} busy={busy} run={run} requestConfirm={requestConfirm} onClose={() => setOutroControlOpen(false)} /> : null}
    </div>
  );
}

function OutroControlDialog({
  reel,
  busy,
  run,
  requestConfirm,
  onClose,
}: {
  reel: Reel;
  busy: boolean;
  run: StudioRun;
  requestConfirm: (action: ConfirmAction) => void;
  onClose: () => void;
}) {
  const reelKey = reel._id ?? reel.id ?? "";
  const canRetry = !reel.skipBrandedOutro && Boolean(reel.bodyVideoUrl) && !REEL_ACTIVE_STATUSES.includes(reel.status);
  const [target, setTarget] = useState("primary");
  const primaryLabel = reel.outro?.channelName || reel.outroInstagramChannelId || reel.outroChannelId || "Primary account";
  const targetOptions: OutroControlTarget[] = [
    { value: "primary", label: `Primary · ${primaryLabel}`, scope: "primary" as const },
    ...(reel.destinations ?? []).map((destination) => ({
      value: destination.id,
      label: `${destination.platform === "instagram" ? "Instagram" : destination.platform === "facebook" ? "Facebook" : destination.platform === "threads" ? "Threads" : "YouTube"} · ${destination.channelLabel || destination.channelId}`,
      scope: "destination" as const,
      destinationId: destination.id,
    })),
  ];
  const selected = targetOptions.find((option) => option.value === target) ?? targetOptions[0];

  const requestRetry = (scope: "all" | "primary" | "destination", destinationId?: string, label?: string) => {
    if (!canRetry) return;
    requestConfirm({
      title: scope === "all" ? "Rebuild every branded outro?" : `Retry ${label ?? "this account"}'s outro?`,
      body: scope === "all"
        ? "Rebuilds every channel's outro card and final destination video over the cached story body."
        : "Rebuilds only this account's outro card and final destination video over the cached story body.",
      details: [
        "The latest connected profile picture, name, and handle are resolved again before the card is drawn.",
        "Existing outro speech is reused exactly when its saved narration matches the current spoken line and voice settings.",
        "The story body, scene images, captions, and body narration are not regenerated.",
      ],
      confirmLabel: scope === "all" ? "Rebuild all outros" : "Retry outro visual",
      costTone: "warm",
      onConfirm: () => run(() => retryReelOutro(reelKey, { scope, destinationId })),
    });
  };

  return (
    <StudioDialog
      title="Outro control centre"
      description="Use this only when a completed outro needs its visual card rebuilt. It deliberately keeps matching cached speech instead of creating a new voice line."
      onClose={onClose}
    >
      <div className="grid gap-3">
        {!canRetry ? (
          <p className="m-0 rounded border border-warning/40 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">
            A completed shared body and an enabled branded outro are required. Wait for any active render to finish, then retry from here.
          </p>
        ) : null}
        <section className="grid gap-2 rounded-md border border-primary/25 bg-primary/[0.035] p-3">
          <div className="grid gap-0.5"><span className="text-xs font-semibold text-foreground">Global visual rebuild</span><span className="text-[11px] text-muted-foreground">Best after reconnecting an account or when several profile cards have missing/old profile information.</span></div>
          <Button type="button" className="justify-self-start" disabled={busy || !canRetry} onClick={() => requestRetry("all")}><RefreshCw size={14} /> Rebuild all outros</Button>
        </section>
        <section className="grid gap-2 rounded-md border border-border bg-card p-3">
          <div className="grid gap-0.5"><span className="text-xs font-semibold text-foreground">One-account visual retry</span><span className="text-[11px] text-muted-foreground">Use when only one channel&apos;s photo, handle, or card failed to appear correctly.</span></div>
          <div className="flex flex-wrap items-end gap-2">
            <Label className="min-w-[220px] flex-1 text-[11px] text-muted-foreground">Account
              <Select value={target} disabled={busy || !canRetry} onChange={(event) => setTarget(event.target.value)}>
                {targetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </Label>
            <Button type="button" variant="outline" disabled={busy || !canRetry || !selected} onClick={() => requestRetry(selected.scope, selected.destinationId, selected.label)}><RefreshCw size={14} /> Retry selected outro</Button>
          </div>
        </section>
        <p className="m-0 text-[11px] leading-relaxed text-muted-foreground/80">If the current spoken line or TTS choice changed since the cached outro was made, the system must create fresh outro speech. Otherwise this is a visual-only retry.</p>
      </div>
    </StudioDialog>
  );
}

function PrimaryOutroFields({
  value,
  platform,
  channelName,
  busy,
  onChange,
  onSave,
  saveLabel,
}: {
  value: OutroSettings;
  platform: Platform;
  channelName: string;
  busy: boolean;
  onChange: (patch: Partial<OutroSettings>) => void;
  onSave: () => void;
  saveLabel: string;
}) {
  return (
    <details className="group rounded border border-border bg-background/40 px-2.5 py-2">
      <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">Edit this primary account's card and call to action</summary>
      <div className="mt-2 grid gap-2">
        <ChannelOutroForm value={value} platform={platform} channelName={channelName} busy={busy} onChange={onChange} />
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onSave}>{saveLabel}</Button>
      </div>
    </details>
  );
}

function ChannelOutroFields({
  value,
  platform,
  channelName,
  storyQuestion,
  busy,
  onChange,
  onSave,
}: {
  value: OutroSettings;
  platform: Platform;
  channelName: string;
  storyQuestion: string;
  busy: boolean;
  onChange: (patch: Partial<OutroSettings>) => void;
  onSave: () => void;
}) {
  return (
    <div className="grid gap-2 border-t border-border px-3 py-2.5">
      <Label className="text-xs text-muted-foreground">
        Local question override <span className="font-normal text-muted-foreground/70">(optional)</span>
        <Textarea rows={2} maxLength={160} disabled={busy} value={value.commentPrompt ?? ""} placeholder={storyQuestion} onChange={(event) => onChange({ commentPrompt: event.target.value })} />
        <span className="mt-1 block text-[10px] text-muted-foreground/70">Leave blank to use the global story question above.</span>
      </Label>
      <ChannelOutroForm value={value} platform={platform} channelName={channelName} busy={busy} onChange={onChange} />
      <Button type="button" size="sm" variant="default" disabled={busy} onClick={onSave}><RefreshCw size={14} /> Save this account's outro</Button>
    </div>
  );
}

function ChannelOutroForm({
  value,
  platform,
  channelName,
  busy,
  onChange,
}: {
  value: OutroSettings;
  platform: Platform;
  channelName: string;
  busy: boolean;
  onChange: (patch: Partial<OutroSettings>) => void;
}) {
  const cta = defaultOutroCta(platform);
  return (
    <>
      <Label className="text-xs text-muted-foreground">
        Spoken channel call to action
        <Textarea rows={2} disabled={busy} value={value.spokenLine ?? ""} placeholder={defaultOutroSpokenLine(platform, channelName)} onChange={(event) => onChange({ spokenLine: event.target.value })} />
      </Label>
      <div className="grid gap-2 sm:grid-cols-2">
        <Label className="text-xs text-muted-foreground">Display name<Input disabled={busy} value={value.channelName ?? ""} placeholder={channelName} onChange={(event) => onChange({ channelName: event.target.value })} /></Label>
        <Label className="text-xs text-muted-foreground">Handle<Input disabled={busy} value={value.channelHandle ?? ""} placeholder="@channel" onChange={(event) => onChange({ channelHandle: event.target.value })} /></Label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Label className="text-xs text-muted-foreground">Card title<Input disabled={busy} value={value.title ?? ""} placeholder={`${cta} FOR MORE`} onChange={(event) => onChange({ title: event.target.value })} /></Label>
        <Label className="text-xs text-muted-foreground">Card subtitle<Input disabled={busy} value={value.subtitle ?? ""} placeholder="More stories after this one" onChange={(event) => onChange({ subtitle: event.target.value })} /></Label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Label className="text-xs text-muted-foreground">CTA button<Input disabled={busy} value={value.cta ?? ""} placeholder={cta} onChange={(event) => onChange({ cta: event.target.value })} /></Label>
        <Label className="text-xs text-muted-foreground">Footer<Input disabled={busy} value={value.footer ?? ""} placeholder="" onChange={(event) => onChange({ footer: event.target.value })} /></Label>
      </div>
    </>
  );
}
