import { getRouteApi } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Reel } from "@/api/reels";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  ConfirmDialog,
  type ConfirmDialogAction,
} from "@/components/ui/confirm-dialog";
import { GenerationTimeline } from "@/components/reels/GenerationTimeline";
import { RecentReelsList } from "@/components/reels/RecentReelsList";
import { ReviewInspector } from "@/components/reels/ReviewInspector";
import { VideoPreview } from "@/components/reels/VideoPreview";
import { useReelSync } from "@/hooks/use-reel-sync";
import { useReelStudio } from "@/store/reel-studio";
import { reelId } from "@/utils/reel";

const route = getRouteApi("/");

const STATUS_FILTERS: Record<
  string,
  { label: string; test: (reel: Reel) => boolean }
> = {
  intake: { label: "Intake", test: (r) => r.status === "pending" },
  in_progress: {
    label: "In Progress",
    test: (r) =>
      [
        "planning",
        "generating_assets",
        "generating_audio",
        "aligning",
        "rendering",
        "uploading",
      ].includes(r.status),
  },
  review: { label: "In Review", test: (r) => r.status === "completed" },
  approved: {
    label: "Approved",
    test: (r) => r.status === "completed" && r.review?.status === "approved",
  },
  published: {
    label: "Published",
    test: (r) => r.youtube?.status === "published",
  },
  rejected: { label: "Rejected", test: (r) => r.status === "failed" },
};

export function ReviewScreen() {
  useReelSync();

  const { status } = route.useSearch();
  const reels = useReelStudio((state) => state.reels);
  const selectedId = useReelStudio((state) => state.selectedId);
  const draftReview = useReelStudio((state) => state.draftReview);
  const error = useReelStudio((state) => state.error);
  const loading = useReelStudio((state) => state.loading);
  const purgeFailed = useReelStudio((state) => state.purgeFailed);
  const [confirmAction, setConfirmAction] = useState<
    ConfirmDialogAction | undefined
  >();

  const activeFilter = status ? STATUS_FILTERS[status] : undefined;
  const filteredReels = useMemo(
    () => (activeFilter ? reels.filter(activeFilter.test) : reels),
    [reels, activeFilter],
  );

  const selected = useMemo(
    () => reels.find((reel) => reelId(reel) === selectedId),
    [reels, selectedId],
  );
  const review = draftReview ?? selected?.review;
  const failedCount = reels.filter((reel) => reel.status === "failed").length;

  return (
    <section className="min-w-0 overflow-x-clip px-4 py-4 sm:px-5 lg:px-6">
      <PageHeader downloadUrl={selected?.outputUrl} />

      {error ? (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs leading-relaxed text-destructive">
          {error}
        </div>
      ) : null}

      {status === "rejected" && failedCount > 0 ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2.5">
          <span className="text-xs font-medium text-destructive">
            {failedCount} failed reel{failedCount === 1 ? "" : "s"} can be
            deleted with recorded S3 assets.
          </span>
          <Button
            type="button"
            variant="destructive"
            disabled={loading}
            onClick={() =>
              setConfirmAction({
                title: "Purge failed reels?",
                body: "Delete all failed reels and their recorded S3 assets.",
                details: [
                  "Global gameplay clips and voice samples will not be touched.",
                ],
                confirmLabel: "Purge failed",
                variant: "destructive",
                onConfirm: () => purgeFailed(),
              })
            }
          >
            <Trash2 size={16} />
            Purge Failed
          </Button>
        </div>
      ) : null}

      <div className="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,430px)]">
        <div className="min-w-0 self-stretch">
          <VideoPreview
            reel={selected}
            reels={filteredReels}
            selectedId={selectedId}
          />
        </div>
        <div className="min-w-0 overflow-hidden">
          <ReviewInspector
            reel={selected}
            review={review}
            selectedId={selectedId}
          />
        </div>
        <div className="grid min-w-0 gap-2.5 xl:col-span-2">
          <GenerationTimeline reel={selected} />
          <RecentReelsList
            selectedId={selectedId}
            reels={filteredReels}
            title={activeFilter ? activeFilter.label : undefined}
          />
        </div>
      </div>
      <ConfirmDialog
        action={confirmAction}
        busy={loading}
        onClose={() => setConfirmAction(undefined)}
      />
    </section>
  );
}
