import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { CreateReelForm } from "@/components/reels/CreateReelForm";
import { useReelStudio } from "@/store/reel-studio";

/** Dedicated reel-creation page — kept off the main review dashboard so the
 * form has room to breathe and the dashboard stays focused on reviewing
 * what's already in flight. Redirects to the dashboard once a reel is created. */
export function CreateReelScreen() {
  const navigate = useNavigate();
  const error = useReelStudio((state) => state.error);

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
        <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">
          Set the niche, genre, source, tier, and background, then generate — you'll be taken to the
          dashboard to watch it render.
        </p>
      </header>

      {error ? (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs leading-relaxed text-destructive">
          {error}
        </div>
      ) : null}

      <div className="mx-auto max-w-5xl">
        <CreateReelForm onCreated={() => void navigate({ to: "/", search: { status: undefined } })} />
      </div>
    </section>
  );
}
