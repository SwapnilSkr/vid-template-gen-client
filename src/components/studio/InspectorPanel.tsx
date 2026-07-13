import { Settings2 } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";
import type { Reel } from "@/api/reels";
import { EditorPanel } from "@/components/studio/EditorPanel";
import { INSPECTOR_TABS } from "@/components/studio/constants";
import type { ConfirmAction, InspectorTab, StudioRun } from "@/components/studio/types";
import { CostPanel } from "@/components/studio/panels/CostPanel";
import { ThumbnailPanel } from "@/components/studio/panels/ThumbnailPanel";
import { cn } from "@/lib/utils";

const CaptionEditor = lazy(() =>
  import("@/components/studio/panels/CaptionEditor").then((m) => ({
    default: m.CaptionEditor,
  })),
);
const EffectsPanel = lazy(() =>
  import("@/components/studio/panels/EffectsPanel").then((m) => ({
    default: m.EffectsPanel,
  })),
);
const OutroPanel = lazy(() =>
  import("@/components/studio/panels/OutroPanel").then((m) => ({
    default: m.OutroPanel,
  })),
);
const DestinationsPanel = lazy(() =>
  import("@/components/studio/panels/DestinationsPanel").then((m) => ({
    default: m.DestinationsPanel,
  })),
);
const PresetsPanel = lazy(() =>
  import("@/components/studio/panels/PresetsPanel").then((m) => ({
    default: m.PresetsPanel,
  })),
);
const PublishPanel = lazy(() =>
  import("@/components/studio/panels/PublishPanel").then((m) => ({
    default: m.PublishPanel,
  })),
);
const RedditSourcePanel = lazy(() =>
  import("@/components/studio/panels/RedditSourcePanel").then((m) => ({
    default: m.RedditSourcePanel,
  })),
);
const UpdatesPanel = lazy(() =>
  import("@/components/studio/panels/UpdatesPanel").then((m) => ({
    default: m.UpdatesPanel,
  })),
);
const RegeneratePanel = lazy(() =>
  import("@/components/studio/panels/RegeneratePanel").then((m) => ({
    default: m.RegeneratePanel,
  })),
);
const StoryPanel = lazy(() =>
  import("@/components/studio/panels/StoryPanel").then((m) => ({
    default: m.StoryPanel,
  })),
);
const VoicePanel = lazy(() =>
  import("@/components/studio/panels/VoicePanel").then((m) => ({ default: m.VoicePanel })),
);

function InspectorTabFallback() {
  return (
    <div className="grid place-items-center py-8 text-xs text-muted-foreground">
      Loading panel…
    </div>
  );
}

export function InspectorPanel({
  tab,
  onTabChange,
  reel,
  seriesReels,
  busy,
  isGameplay,
  run,
  requestConfirm,
}: {
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  reel: Reel;
  seriesReels: Reel[];
  busy: boolean;
  isGameplay: boolean;
  run: StudioRun;
  requestConfirm: (action: ConfirmAction) => void;
}) {
  const tabs = isGameplay
    ? INSPECTOR_TABS.filter((item) => item.id !== "look" && item.id !== "effects")
    : INSPECTOR_TABS;

  useEffect(() => {
    if (!isGameplay) return;
    if (tab === "look" || tab === "effects") onTabChange("source");
  }, [isGameplay, tab, onTabChange]);

  return (
    <EditorPanel
      title="Inspector"
      icon={<Settings2 size={15} />}
      className="overflow-hidden xl:max-h-[calc(100vh-73px)]"
    >
      <div className="border-b border-border bg-background">
        <div className="studio-scrollbar flex min-w-0 gap-1 overflow-x-auto overscroll-x-contain p-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={cn(
                "inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                item.id === "thumbnail" ? "min-w-[92px]" : "min-w-[86px]",
                tab === item.id
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0 overflow-x-hidden p-3 xl:max-h-[calc(100vh-164px)] xl:overflow-y-auto">
        <Suspense fallback={<InspectorTabFallback />}>
          {tab === "source" ? (
            isGameplay ? (
              <div className="grid gap-4">
                <RedditSourcePanel
                  reel={reel}
                  busy={busy}
                  run={run}
                  requestConfirm={requestConfirm}
                />
                <UpdatesPanel
                  reel={reel}
                  busy={busy}
                  run={run}
                  requestConfirm={requestConfirm}
                />
              </div>
            ) : (
              <StoryPanel
                reel={reel}
                busy={busy}
                run={run}
                requestConfirm={requestConfirm}
              />
            )
          ) : null}
          {tab === "voice" ? (
            <VoicePanel reel={reel} busy={busy} run={run} requestConfirm={requestConfirm} />
          ) : null}
          {tab === "look" && !isGameplay ? (
            <PresetsPanel
              reel={reel}
              busy={busy}
              run={run}
              requestConfirm={requestConfirm}
            />
          ) : null}
          {tab === "effects" && !isGameplay ? (
            <EffectsPanel
              reel={reel}
              busy={busy}
              run={run}
              requestConfirm={requestConfirm}
            />
          ) : null}
          {tab === "outro" ? (
            <div className="grid gap-4">
              {isGameplay ? <DestinationsPanel reel={reel} busy={busy} run={run} /> : null}
              <OutroPanel
                reel={reel}
                busy={busy}
                run={run}
                requestConfirm={requestConfirm}
              />
            </div>
          ) : null}
          {tab === "thumbnail" ? <ThumbnailPanel reel={reel} /> : null}
          {tab === "captions" ? (
            <CaptionEditor
              reel={reel}
              busy={busy}
              run={run}
              requestConfirm={requestConfirm}
            />
          ) : null}
          {tab === "export" ? (
            <div className="grid gap-3">
              <RegeneratePanel
                reel={reel}
                busy={busy}
                run={run}
                requestConfirm={requestConfirm}
              />
              <PublishPanel
                reel={reel}
                busy={busy}
                run={run}
                requestConfirm={requestConfirm}
              />
              <CostPanel reel={reel} seriesReels={seriesReels} />
            </div>
          ) : null}
        </Suspense>
      </div>
    </EditorPanel>
  );
}
