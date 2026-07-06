import { Link } from "@tanstack/react-router";
import { Cloud, HardDrive, Trash2 } from "lucide-react";
import { memo } from "react";
import type { YtImport } from "@/api/yt-imports";
import { Button } from "@/components/ui/button";

function statusLabel(status: YtImport["status"]): string {
  switch (status) {
    case "pending":
      return "Queued";
    case "downloading":
      return "Downloading";
    case "uploading":
      return "Uploading to S3";
    case "extracting_frames":
      return "Extracting frames";
    case "completed":
      return "Ready";
    case "failed":
      return "Failed";
  }
}

interface YtImportListItemProps {
  item: YtImport;
  onDelete: (id: string) => void;
}

export const YtImportListItem = memo(function YtImportListItem({
  item,
  onDelete,
}: YtImportListItemProps) {
  const inProgress = item.status !== "completed" && item.status !== "failed";

  return (
    <div className="mb-2 rounded-md border border-border/60 p-2.5 last:mb-0">
      <Link
        to="/youtube/$importId"
        params={{ importId: item._id }}
        className="block text-sm font-medium text-foreground no-underline hover:text-primary"
      >
        {item.title}
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {item.storage === "s3" ? <Cloud size={12} /> : <HardDrive size={12} />}
        <span>{statusLabel(item.status)}</span>
        {inProgress ? <span>{item.progress}%</span> : null}
      </div>
      {item.status === "failed" && item.error ? (
        <p className="mt-1 text-xs text-destructive">{item.error}</p>
      ) : null}
      <div className="mt-2 flex gap-2">
        <Button
          variant="ghost"
          size="default"
          className="min-h-8 px-2 text-xs"
          onClick={() => onDelete(item._id)}
        >
          <Trash2 size={14} />
          Delete
        </Button>
      </div>
    </div>
  );
});
