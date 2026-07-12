import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { Reel } from "@/api/reels";
import { Button } from "@/components/ui/button";
import {
  ConfirmDialog,
  type ConfirmDialogAction,
} from "@/components/ui/confirm-dialog";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { useReelStudio } from "@/store/reel-studio";
import { cn } from "@/lib/utils";
import { formatLabel, reelId } from "@/utils/reel";
import { ReelStatusChip } from "./ReelStatusChip";

interface RecentReelsListProps {
  selectedId?: string;
  reels?: Reel[];
  title?: string;
}

export function RecentReelsList({
  selectedId,
  reels: reelsProp,
  title,
}: RecentReelsListProps) {
  const navigate = useNavigate();
  const storeReels = useReelStudio((state) => state.reels);
  const select = useReelStudio((state) => state.select);
  const deleteById = useReelStudio((state) => state.deleteById);
  const loading = useReelStudio((state) => state.loading);
  const [confirmAction, setConfirmAction] = useState<
    ConfirmDialogAction | undefined
  >();
  const reels = reelsProp ?? storeReels;
  
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const items = useMemo(() => {
    const result: any[] = [];
    const groups = new Map<string, Reel[]>();
    
    for (const reel of reels) {
      if ((reel.partCount ?? 1) > 1) {
        const key = reel.seriesId || reel.title || reel.topic || "Untitled series";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(reel);
      }
    }
    
    const processedGroups = new Set<string>();
    for (const reel of reels) {
      if ((reel.partCount ?? 1) > 1) {
        const key = reel.seriesId || reel.title || reel.topic || "Untitled series";
        if (processedGroups.has(key)) continue;
        processedGroups.add(key);
        const children = groups.get(key)!;
        const count = Math.max(reel.partCount ?? 1, children.length);
        
        const firstReel = children[0] || reel;
        let displayTitle = firstReel.title || firstReel.topic || "Untitled series";
        if (displayTitle.length > 50) {
          displayTitle = displayTitle.substring(0, 50) + "...";
        }

        result.push({ type: "group", key, title: displayTitle, count, children });
      } else {
        result.push({ type: "reel", key: reelId(reel), reel, isChild: false });
      }
    }
    return result;
  }, [reels]);

  const renderReel = (reel: Reel, isChild: boolean) => {
    const id = reelId(reel);
    const isSelected = selectedId === id;
    return (
      <div
        key={id}
        className={cn(
          "group relative cursor-pointer grid min-h-11 w-full grid-cols-1 items-center gap-1 border-b border-border/30 bg-transparent py-2.5 text-left text-[15px] transition-all duration-200 md:grid-cols-[minmax(170px,1.5fr)_minmax(90px,0.6fr)_92px_100px_140px] md:gap-2.5",
          "hover:bg-white/[0.02]",
          isSelected ? "bg-indigo-500/[0.06] border-l-2 border-l-indigo-500" : "",
          isChild ? (isSelected ? "pl-7 md:pl-7" : "pl-8 md:pl-8") : (isSelected ? "pl-3 md:pl-3" : "pl-4 md:pl-4"),
        )}
        onClick={() => void select(id)}
      >
        <button
          type="button"
          className={cn(
            "min-w-0 border-0 bg-transparent p-0 text-left text-[15px] transition-colors pr-8",
            isSelected ? "font-semibold text-indigo-300" : "font-medium text-foreground/85 hover:text-foreground"
          )}
          onClick={() => void select(id)}
        >
          <span className="block truncate">
            {reel.title || reel.topic || "Untitled reel"}
          </span>
        </button>
        <button
          type="button"
          className={cn(
            "min-w-0 border-0 bg-transparent p-0 text-left text-[15px] transition-colors",
            isSelected ? "text-indigo-300/90" : "text-muted-foreground"
          )}
          onClick={() => void select(id)}
        >
          <span className="block truncate">
            {formatLabel(reel.genre)}
          </span>
        </button>
        <button
          type="button"
          className={cn(
            "min-w-0 border-0 bg-transparent p-0 text-left text-[15px] transition-colors",
            isSelected ? "text-indigo-300/90" : "text-muted-foreground"
          )}
          onClick={() => void select(id)}
        >
          <span className="block truncate">
            {(reel.partCount ?? 1) > 1
              ? `Part ${reel.partNumber ?? 1}/${reel.partCount}`
              : reel.niche.startsWith("horror")
                ? "Standalone"
                : (reel.storySource ?? reel.source ?? "auto")}
          </span>
        </button>
        <button
          type="button"
          className="border-0 bg-transparent p-0 text-left"
          onClick={() => void select(id)}
        >
          <ReelStatusChip status={reel.status} className="not-italic" />
        </button>
        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 pr-2 md:pr-4">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            title="Open in Studio"
            className="h-8 hover:bg-white/10 text-xs gap-1.5 font-medium"
            onClick={(e) => { e.stopPropagation(); void navigate({ to: "/studio/$id", params: { id } }); }}
          >
            <Pencil size={14} />
            Open in Studio
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            title="Delete reel and its S3 assets"
            disabled={loading}
            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmAction({
                title: "Delete reel and assets?",
                body: "Delete this reel and its recorded S3 assets.",
                details: [
                  "Global gameplay clips and voice samples will not be touched.",
                ],
                confirmLabel: "Delete reel",
                variant: "destructive",
                onConfirm: () => deleteById(id),
              });
            }}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Panel className="overflow-hidden">
        <PanelHeader>
          <PanelTitle>
            {title ?? "Recent Reels in Review"} ({reels.length})
          </PanelTitle>
        </PanelHeader>

        <div className="grid">
          <div className="hidden min-h-10 grid-cols-[minmax(170px,1.5fr)_minmax(90px,0.6fr)_92px_100px_140px] items-center gap-2.5 border-b border-border/30 bg-white/[0.02] px-4 py-3 text-[12px] font-bold uppercase tracking-wider text-muted-foreground/80 md:grid">
            <span>Title</span>
            <span>Genre</span>
            <span>Mode</span>
            <span>Status</span>
            <span></span>
          </div>

          {items.map((item) => {
            if (item.type === "group") {
              const isExpanded = expandedGroups.has(item.key);
              return (
                <div key={item.key}>
                  <div
                    className="group relative flex min-h-11 w-full cursor-pointer items-center justify-between border-b border-border/30 bg-transparent px-4 py-2.5 text-left text-[15px] transition-all duration-200 hover:bg-white/[0.02]"
                    onClick={() => toggleGroup(item.key)}
                  >
                    <div className="flex items-center gap-2 font-medium text-foreground/85 group-hover:text-foreground">
                      <ChevronRight size={16} className={cn("transition-transform", isExpanded && "rotate-90")} />
                      <span className="block truncate">{item.title} ({item.count} Parts)</span>
                    </div>
                  </div>
                  {isExpanded && item.children.map((childReel: Reel) => renderReel(childReel, true))}
                </div>
              );
            } else {
              return renderReel(item.reel, false);
            }
          })}
        </div>
      </Panel>
      <ConfirmDialog
        action={confirmAction}
        busy={loading}
        onClose={() => setConfirmAction(undefined)}
      />
    </>
  );
}
