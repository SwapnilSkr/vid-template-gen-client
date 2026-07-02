import { getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";
import type { Reel } from "@/api/reels";
import { PageHeader } from "@/components/layout/PageHeader";
import { GenerationTimeline } from "@/components/reels/GenerationTimeline";
import { RecentReelsList } from "@/components/reels/RecentReelsList";
import { ReviewInspector } from "@/components/reels/ReviewInspector";
import { VideoPreview } from "@/components/reels/VideoPreview";
import { VoiceVariantsPanel } from "@/components/reels/VoiceVariantsPanel";
import { useReelSync } from "@/hooks/use-reel-sync";
import { useReelStudio } from "@/store/reel-studio";
import { reelId } from "@/utils/reel";

const route = getRouteApi("/");

const STATUS_FILTERS: Record<string, { label: string; test: (reel: Reel) => boolean }> = {
  intake: { label: "Intake", test: (r) => r.status === "pending" },
  in_progress: {
    label: "In Progress",
    test: (r) => ["planning", "generating_assets", "generating_audio", "aligning", "rendering", "uploading"].includes(r.status),
  },
  review: { label: "In Review", test: (r) => r.status === "completed" },
  approved: { label: "Approved", test: (r) => r.status === "completed" && r.review?.status === "approved" },
  published: { label: "Published", test: (r) => r.youtube?.status === "published" },
  rejected: { label: "Rejected", test: (r) => r.status === "failed" },
};

export function ReviewScreen() {
  useReelSync();

  const { status } = route.useSearch();
  const reels = useReelStudio((state) => state.reels);
  const selectedId = useReelStudio((state) => state.selectedId);
  const draftReview = useReelStudio((state) => state.draftReview);
  const error = useReelStudio((state) => state.error);

  const activeFilter = status ? STATUS_FILTERS[status] : undefined;
  const filteredReels = useMemo(
    () => (activeFilter ? reels.filter(activeFilter.test) : reels),
    [reels, activeFilter]
  );

  const selected = useMemo(
    () => reels.find((reel) => reelId(reel) === selectedId),
    [reels, selectedId]
  );
  const review = draftReview ?? selected?.review;

  return (
    <section className="min-w-0 px-4 py-4 sm:px-5 lg:px-6">
      <PageHeader downloadUrl={selected?.outputUrl} />

      {error ? (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs leading-relaxed text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid items-start gap-2.5 xl:grid-cols-[minmax(520px,1fr)_minmax(360px,430px)]">
        <div className="grid min-w-0 gap-2.5">
          <VideoPreview reel={selected} />
          <GenerationTimeline reel={selected} />
          <VoiceVariantsPanel reel={selected} />
          <RecentReelsList
            selectedId={selectedId}
            reels={filteredReels}
            title={activeFilter ? activeFilter.label : undefined}
          />
        </div>
        <ReviewInspector reel={selected} review={review} selectedId={selectedId} />
      </div>
    </section>
  );
}
