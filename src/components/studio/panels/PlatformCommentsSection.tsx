import { AtSign, ExternalLink, Facebook, Instagram, MessageCircle, Youtube } from "lucide-react";
import type { ReactNode } from "react";
import type { Reel } from "@/api/reels";
import { DEFAULT_OUTRO_COMMENT_PROMPT } from "@/components/studio/utils";
import { cn } from "@/lib/utils";

type PublishStatus = "pending" | "uploading" | "published" | "failed";
type CommentStatus = "pending" | "posted" | "failed" | "skipped";

interface PlatformCommentRow {
  key: string;
  platform: "youtube" | "instagram" | "facebook" | "threads";
  icon: ReactNode;
  label: string;
  publishStatus?: PublishStatus;
  publishUrl?: string;
  publishError?: string;
  discussionStatus?: CommentStatus;
  discussionError?: string;
  navigationStatus?: CommentStatus;
  navigationError?: string;
  discussionText: string;
}

function discussionTextFor(reel: Reel, platform: PlatformCommentRow["platform"], channelId?: string): string {
  const destinationPrompt = channelId
    ? (reel.destinations ?? []).find(
        (destination) => destination.platform === platform && destination.channelId === channelId,
      )?.outro?.commentPrompt?.trim()
    : undefined;
  return (
    destinationPrompt ||
    reel.outro?.commentPrompt?.trim() ||
    DEFAULT_OUTRO_COMMENT_PROMPT
  );
}

function commentTone(status?: string): string {
  if (status === "posted") return "bg-success/10 text-success";
  if (status === "failed") return "bg-destructive/10 text-destructive";
  if (status === "skipped" || status === "pending") return "bg-warning/10 text-warning";
  return "bg-secondary text-muted-foreground";
}

function publishTone(status?: string): string {
  if (status === "published") return "text-success";
  if (status === "failed") return "text-destructive";
  if (status === "pending" || status === "uploading") return "text-warning";
  return "text-muted-foreground";
}

function buildRows(reel: Reel): PlatformCommentRow[] {
  const rows: PlatformCommentRow[] = [];

  if (reel.youtube) {
    rows.push({
      key: `youtube:${reel.youtube.channelId ?? "default"}`,
      platform: "youtube",
      icon: <Youtube size={12} className="text-red-500" />,
      label: reel.youtube.channelLabel || "YouTube",
      publishStatus: reel.youtube.status,
      publishUrl: reel.youtube.url,
      publishError: reel.youtube.error,
      discussionStatus: reel.youtube.firstCommentStatus,
      discussionError: reel.youtube.firstCommentError,
      navigationStatus: reel.youtube.seriesNavigationStatus,
      navigationError: reel.youtube.seriesNavigationCommentError,
      discussionText: discussionTextFor(reel, "youtube", reel.youtube.channelId),
    });
  }

  for (const publish of reel.instagram ?? []) {
    rows.push({
      key: `instagram:${publish.channelId}`,
      platform: "instagram",
      icon: <Instagram size={12} className="text-pink-500" />,
      label: publish.channelLabel || publish.channelId,
      publishStatus: publish.status,
      publishUrl: publish.url,
      publishError: publish.error,
      discussionStatus: publish.firstCommentStatus,
      discussionError: publish.firstCommentError,
      navigationStatus: publish.seriesNavigationStatus,
      navigationError: publish.seriesNavigationCommentError,
      discussionText: discussionTextFor(reel, "instagram", publish.channelId),
    });
  }

  for (const publish of reel.facebook ?? []) {
    rows.push({
      key: `facebook:${publish.channelId}`,
      platform: "facebook",
      icon: <Facebook size={12} className="text-blue-600" />,
      label: publish.channelLabel || publish.channelId,
      publishStatus: publish.status,
      publishUrl: publish.url,
      publishError: publish.error,
      discussionStatus: publish.firstCommentStatus,
      discussionError: publish.firstCommentError,
      navigationStatus: publish.seriesNavigationStatus,
      navigationError: publish.seriesNavigationCommentError,
      discussionText: discussionTextFor(reel, "facebook", publish.channelId),
    });
  }

  for (const publish of reel.threads ?? []) {
    rows.push({
      key: `threads:${publish.channelId}`,
      platform: "threads",
      icon: <AtSign size={12} />,
      label: publish.channelLabel || publish.channelId,
      publishStatus: publish.status,
      publishUrl: publish.url,
      publishError: publish.error,
      discussionStatus: publish.firstCommentStatus,
      discussionError: publish.firstCommentError,
      navigationStatus: publish.seriesNavigationStatus,
      navigationError: publish.seriesNavigationCommentError,
      discussionText: discussionTextFor(reel, "threads", publish.channelId),
    });
  }

  return rows;
}

/**
 * Shows the own-post discussion comment (and navigation status) for every
 * platform that has been queued or attempted — including failed uploads that
 * never reached the comment step.
 */
export function PlatformCommentsSection({ reel }: { reel: Reel }) {
  if (reel.status !== "completed") return null;
  const rows = buildRows(reel);
  const prompt = reel.outro?.commentPrompt?.trim() || DEFAULT_OUTRO_COMMENT_PROMPT;

  return (
    <section className="grid gap-2 rounded-md border border-border bg-background/35 p-2.5">
      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <MessageCircle size={13} className="text-primary" />
        Own-post comments by platform
      </div>
      <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
        Discussion copy is ready before publish. It posts only after that platform upload succeeds.
      </p>
      <blockquote className="m-0 rounded border border-border/70 bg-card/40 px-2.5 py-2 text-[11px] leading-relaxed text-foreground">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Discussion text</span>
        {prompt}
      </blockquote>
      {rows.length ? (
        <div className="grid gap-1.5">
          {rows.map((row) => (
            <div key={row.key} className="grid gap-1.5 rounded border border-border bg-card/50 px-2.5 py-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex min-w-0 items-center gap-1 font-medium">
                  {row.icon}
                  <span className="truncate">{row.label}</span>
                </span>
                <span className={cn("capitalize", publishTone(row.publishStatus))}>
                  upload: {row.publishStatus ?? "not sent"}
                </span>
                {row.publishUrl ? (
                  <a href={row.publishUrl} target="_blank" rel="noreferrer" className="text-primary">
                    <ExternalLink size={11} />
                  </a>
                ) : null}
                <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px] capitalize", commentTone(row.discussionStatus))}>
                  discussion: {row.discussionStatus ?? "not posted"}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] capitalize", commentTone(row.navigationStatus))}>
                  navigation: {row.navigationStatus ?? "waiting"}
                </span>
              </div>
              <p className="m-0 text-[11px] leading-relaxed text-foreground/90">
                “{row.discussionText}”
              </p>
              <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
                {row.publishStatus === "published"
                  ? row.discussionStatus === "posted"
                    ? "Posted after upload."
                    : row.discussionStatus === "failed"
                      ? "Upload succeeded, but the discussion comment failed."
                      : "Upload succeeded — discussion comment has not posted yet."
                  : row.publishStatus === "failed"
                    ? "Upload failed, so the discussion comment was not sent."
                    : row.publishStatus === "pending" || row.publishStatus === "uploading"
                      ? "Waiting for upload to finish before commenting."
                      : "Not sent yet."}
              </p>
              {(row.publishError || row.discussionError || row.navigationError) ? (
                <p className="m-0 text-[11px] text-destructive" title={row.publishError || row.discussionError || row.navigationError}>
                  {row.discussionError || row.navigationError || row.publishError}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="m-0 rounded border border-dashed border-border px-2.5 py-2 text-[11px] text-muted-foreground">
          No platform uploads attempted yet. After you publish, each destination appears here with comment status.
        </p>
      )}
    </section>
  );
}
