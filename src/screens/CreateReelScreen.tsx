import { useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CreateReelForm } from "@/components/reels/CreateReelForm";
import { FfmpegBlockModal } from "@/components/reels/FfmpegBlockModal";
import { CaptionSmokeButton } from "@/components/reels/CaptionSmokeDialog";
import { useReelStudio } from "@/store/reel-studio";

/** Dedicated reel-creation page — kept off the main review dashboard so the
 * form has room to breathe and the dashboard stays focused on reviewing
 * what's already in flight. Review mode opens Studio; auto mode goes to the dashboard. */
export function CreateReelScreen() {
  const navigate = useNavigate();
  const error = useReelStudio((state) => state.error);
  const ffmpegBlock = useReelStudio((state) => state.ffmpegBlock);
  const clearFfmpegBlock = useReelStudio((state) => state.clearFfmpegBlock);

  return (
    <section className="min-w-0 px-4 py-4 sm:px-5 lg:px-6">
      <header className="mb-5 grid gap-2 border-b border-border pb-4">
        <Link
          to="/"
          search={{ status: undefined }}
          className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted-foreground no-underline hover:text-foreground"
        >
          <ArrowLeft size={15} /> Back to dashboard
        </Link>
        <h1 className="m-0 text-lg leading-tight text-foreground">Create New Reel</h1>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
            Set niche, genre, and background — browse a story for Reddit reels, then create. Review mode
            opens Studio; auto mode returns to the dashboard.
          </p>
          <CaptionSmokeButton size="sm" variant="ghost" label="Test captions" />
        </div>
      </header>

      {error ? (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs leading-relaxed text-destructive">
          {error}
        </div>
      ) : null}

      <div className="mx-auto max-w-5xl">
        <CreateReelForm
          onCreated={(result) => {
            if (result.pipelineMode === "review") {
              void navigate({ to: "/studio/$id", params: { id: result.id } });
            } else {
              void navigate({ to: "/", search: { status: undefined } });
            }
          }}
        />
      </div>

      <FfmpegBlockModal capability={ffmpegBlock} onClose={clearFfmpegBlock} />
    </section>
  );
}
