import { Link } from "@tanstack/react-router";
import { Bell, CircleHelp, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  downloadUrl?: string;
}

export function PageHeader({ downloadUrl }: PageHeaderProps) {
  return (
    <header className="mb-3.5 grid min-h-12 gap-3 sm:flex sm:items-start sm:justify-between">
      <div>
        <h1 className="m-0 text-2xl leading-tight tracking-normal text-foreground">Production Review</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          Review, edit and approve reels before publishing.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" aria-label="Help">
          <CircleHelp size={18} />
        </Button>
        <Button type="button" variant="outline" size="icon" aria-label="Notifications">
          <Bell size={18} />
        </Button>
        <Link
          to="/reels/new"
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-primary bg-primary px-3 py-2 text-[13px] font-bold text-primary-foreground no-underline hover:bg-primary/90"
        >
          <Sparkles size={17} />
          New Reel
        </Link>
        {downloadUrl ? (
          <a
            className={cn(
              "inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-foreground bg-foreground px-3 py-2 text-[13px] font-bold text-primary-foreground no-underline"
            )}
            href={downloadUrl}
            download
            target="_blank"
            rel="noreferrer"
          >
            <Download size={17} />
            Download
          </a>
        ) : null}
      </div>
    </header>
  );
}
