import { Link } from "@tanstack/react-router";
import { Download, Plus } from "lucide-react";
import { CaptionSmokeButton } from "@/components/reels/CaptionSmokeDialog";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  downloadUrl?: string;
}

export function PageHeader({ downloadUrl }: PageHeaderProps) {
  return (
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <div>
        <h1 className="m-0 text-lg font-semibold leading-tight text-foreground">Production Review</h1>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
          Review, edit and approve reels before publishing.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <CaptionSmokeButton size="sm" variant="ghost" label="Test captions" />
        {downloadUrl ? (
          <a
            className={cn(buttonClassName("outline"), "no-underline")}
            href={downloadUrl}
            download
            target="_blank"
            rel="noreferrer"
          >
            <Download size={15} />
            Download
          </a>
        ) : null}
        <Link
          to="/reels/new"
          className={cn(buttonClassName("default"), "no-underline")}
        >
          <Plus size={15} />
          New Reel
        </Link>
      </div>
    </header>
  );
}
