import { CheckCircle2, Clapperboard, Image, Loader2, RefreshCw, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Reel, ReelReview } from "@/api/reels";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelTitle, panelClassName } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { useReelStudio } from "@/store/reel-studio";
import { reelTopStatus } from "@/utils/reel";

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
  const approveReview = useReelStudio((state) => state.approveReview);
  const publish = useReelStudio((state) => state.publish);

  const [draft, setDraft] = useState<ReelReview | undefined>(review);
  const [frameSeconds, setFrameSeconds] = useState("1");
  const tagsText = useMemo(() => draft?.tags.join(", ") ?? "", [draft?.tags]);

  useEffect(() => {
    setDraft(review);
  }, [review]);

  const completed = reel?.status === "completed";
  const canReview = completed && Boolean(draft);

  function updateDraft(updater: (current: ReelReview) => ReelReview) {
    setDraft((current) => (current ? updater(current) : current));
  }

  return (
    <aside className={cn(panelClassName, "grid gap-3 p-3.5 xl:sticky xl:top-4")}>
      <div className="flex items-center justify-between gap-3">
        <PanelTitle>Review Package</PanelTitle>
        <span className="rounded-full bg-warning px-2.5 py-1 text-xs font-extrabold text-warning-foreground">
          {reelTopStatus(reel, draft)}
        </span>
      </div>

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
          <PanelTitle>Thumbnail Concept</PanelTitle>
          <span className="text-xs text-muted-foreground">Used on publish</span>
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

        <Label>
          Concept prompt
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
          onClick={() => draft && void regenerateThumbnail(draft)}
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          Regenerate Thumbnail (AI)
        </Button>

        <p className="m-0 text-xs leading-relaxed text-muted-foreground">
          The AI thumbnail is generated from the reviewed title plus this concept (with current trend patterns
          applied), stored on the reel, then attached during YouTube publishing.
        </p>

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
            onClick={() => void useFrameAsThumbnail(Math.max(Number(frameSeconds) || 0, 0))}
          >
            <Clapperboard size={16} />
            Use Video Frame
          </Button>
        </div>
      </div>

      <div className="rounded-lg bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        {draft?.visibilityNotes ?? "Visibility guidance appears after the reel finishes."}
      </div>

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
        <Button type="button" variant="outline" disabled={!canReview} onClick={() => draft && void saveReview(draft)}>
          <RefreshCw size={16} />
          Save Changes
        </Button>
        <Button type="button" variant="default" disabled={!canReview} onClick={() => void approveReview()}>
          <CheckCircle2 size={16} />
          Approve
        </Button>
      </div>

      <Button type="button" variant="default" className="w-full" disabled={!completed} onClick={() => void publish()}>
        <Send size={17} />
        Publish to YouTube Shorts
      </Button>

      {reel?.youtube?.url ? (
        <a
          className="text-center text-[13px] font-bold text-primary no-underline"
          href={reel.youtube.url}
          target="_blank"
          rel="noreferrer"
        >
          Open published Short
        </a>
      ) : null}
    </aside>
  );
}
