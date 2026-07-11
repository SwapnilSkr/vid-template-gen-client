import {
  BookOpen,
  Clapperboard,
  ExternalLink,
  FileText,
  GitBranch,
  Image,
  ShieldCheck,
  Sparkles,
  UserCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Reel } from "@/api/reels";
import { cn } from "@/lib/utils";

export function StoryFlowPanel({ reel }: { reel?: Reel }) {
  if (!reel) {
    return (
      <div className="rounded-lg border border-border bg-muted/35 p-3 text-xs font-semibold text-muted-foreground">
        Select a reel to inspect story sourcing and generation flow.
      </div>
    );
  }

  const isReddit = reel.niche === "reddit" || Boolean(reel.redditStory);
  const isHorror =
    reel.niche.startsWith("horror") ||
    Boolean(reel.storyBible || reel.horrorReference);
  if (!isReddit && !isHorror) return null;

  return (
    <div className="grid gap-2.5 rounded-lg border border-border bg-black/15 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <GitBranch size={16} />
          Story Flow
        </span>
        <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
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
        detail={
          story?.subreddit
            ? `${story.subreddit}${story.author ? ` · u/${story.author}` : ""}`
            : (reel.genre ?? "Reddit story")
        }
        state={
          story ? "done" : reel.status === "planning" ? "active" : "pending"
        }
      />
      <FlowStep
        icon={<ShieldCheck size={15} />}
        label="Reuse guard"
        value={
          story?.seedUrl
            ? "Mongo checked active reel seed URLs"
            : "Waiting for Reddit seed URL"
        }
        detail={
          story?.seedTitle ??
          story?.title ??
          "The same Reddit seed is skipped until its reel is deleted."
        }
        href={story?.seedUrl}
        state={story?.seedUrl ? "done" : "pending"}
      />
      <FlowStep
        icon={<GitBranch size={15} />}
        label="Thread resolver"
        value={
          source === "verbatim"
            ? "Post body + OP updates + later author posts"
            : "Generated or rewritten from selected source"
        }
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
        state={
          reel.narrationVoice
            ? "done"
            : reel.status === "planning"
              ? "active"
              : "pending"
        }
      />
      <FlowStep
        icon={<Clapperboard size={15} />}
        label="Render path"
        value={
          reel.status === "completed"
            ? "Rendered with gameplay, captions, outro, and review package"
            : `${reel.status} · ${reel.progress}%`
        }
        detail={
          reel.gameplayKey
            ? `Gameplay: ${reel.gameplayKey}`
            : "Gameplay clip is recorded once selected."
        }
        state={
          reel.status === "completed"
            ? "done"
            : reel.status === "failed"
              ? "blocked"
              : "active"
        }
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
        state={
          reference ? "done" : reel.status === "planning" ? "active" : "pending"
        }
      />
      <FlowStep
        icon={<ShieldCheck size={15} />}
        label="Reuse guard"
        value={
          reference
            ? "Mongo checked active reel reference URLs"
            : "Waiting for selected reference"
        }
        detail="The same reference is skipped until the reel using it is deleted."
        state={reference ? "done" : "pending"}
      />
      <FlowStep
        icon={<Sparkles size={15} />}
        label="Story bible"
        value={bible?.premise ?? "Not planned yet"}
        detail={
          bible
            ? `Anchor: ${bible.anchorObject} · Rule: ${bible.impossibleRule}`
            : "Pass one creates premise, anchor object, rule, escalation, and twist."
        }
        state={
          bible ? "done" : reel.status === "planning" ? "active" : "pending"
        }
      />
      {bible?.escalation?.length ? (
        <div className="grid gap-1 rounded-md border border-border bg-background/65 p-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
            Escalation ladder
          </span>
          <div className="grid gap-1">
            {bible.escalation.slice(0, 5).map((beat, index) => (
              <div
                key={`${index}-${beat}`}
                className="grid grid-cols-[18px_1fr] gap-1.5 text-xs leading-snug"
              >
                <span className="font-semibold text-primary">{index + 1}</span>
                <span className="text-muted-foreground">{beat}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <FlowStep
        icon={<Image size={15} />}
        label="Visual/audio path"
        value={
          reel.status === "completed"
            ? "Scenes, voice, captions, horror mix, and review package complete"
            : `${reel.status} · ${reel.progress}%`
        }
        detail={
          [
            reel.artStyleId ? `Art: ${reel.artStyleId}` : undefined,
            reel.motionMode ? `Motion: ${reel.motionMode}` : undefined,
            reel.horrorAudioKey
              ? `Audio bed: ${reel.horrorAudioKey}`
              : undefined,
          ]
            .filter(Boolean)
            .join(" · ") ||
          "Art, motion, and audio choices appear after planning."
        }
        state={
          reel.status === "completed"
            ? "done"
            : reel.status === "failed"
              ? "blocked"
              : "active"
        }
      />
      <FlowStep
        icon={<UserCircle size={15} />}
        label="Narration voice"
        value={voiceLabel(reel)}
        detail={
          reel.voiceOverride
            ? "Custom voice selected at creation."
            : "Resolved from niche/tier defaults."
        }
        state={
          reel.narrationVoice
            ? "done"
            : reel.status === "planning"
              ? "active"
              : "pending"
        }
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
    <div className="grid grid-cols-[28px_1fr] gap-2 rounded-md border border-border bg-card/70 p-2.5">
      <div
        className={cn(
          "grid h-7 w-7 place-items-center rounded-full",
          state === "done" && "bg-success/20 text-success-foreground",
          state === "active" && "bg-warning/20 text-warning",
          state === "pending" && "bg-muted text-muted-foreground",
          state === "blocked" && "bg-destructive/15 text-destructive",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
            {label}
          </span>
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-primary"
            >
              <ExternalLink size={13} />
            </a>
          ) : null}
        </div>
        <div className="wrap-break-word text-xs font-semibold leading-snug text-foreground">
          {value}
        </div>
        {detail ? (
          <div className="mt-1 wrap-break-word text-xs leading-snug text-muted-foreground">
            {detail}
          </div>
        ) : null}
      </div>
    </div>
  );
}
