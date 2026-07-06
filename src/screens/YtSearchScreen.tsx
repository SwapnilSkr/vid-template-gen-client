import { useNavigate } from "@tanstack/react-router";
import { Loader2, Search } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import {
  createYtImport,
  deleteYtImport,
  searchYoutube,
  type YtImportStorage,
  type YoutubeSearchResult,
} from "@/api/yt-imports";
import { Button } from "@/components/ui/button";
import {
  ConfirmDialog,
  type ConfirmDialogAction,
} from "@/components/ui/confirm-dialog";
import { Input, Select } from "@/components/ui/input";
import {
  Panel,
  PanelHeader,
  PanelTitle,
  panelClassName,
} from "@/components/ui/panel";
import {
  FrameRangeControls,
  parseFrameRange,
  type FrameRangeValues,
} from "@/components/youtube/FrameRangeControls";
import { YtImportListItem } from "@/components/youtube/YtImportListItem";
import { YoutubeSearchResultCard } from "@/components/youtube/YoutubeSearchResultCard";
import { useYtImportsPoll } from "@/hooks/use-yt-imports-poll";
import { cn } from "@/lib/utils";

export function YtSearchScreen() {
  const navigate = useNavigate();
  const {
    imports,
    loading: loadingImports,
    error,
    refresh,
    setError,
  } = useYtImportsPoll();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YoutubeSearchResult[]>([]);
  const [searchPending, startSearchTransition] = useTransition();
  const [downloadPending, startDownloadTransition] = useTransition();
  const [downloadingId, setDownloadingId] = useState<string | undefined>();

  const [storage, setStorage] = useState<YtImportStorage>("local");
  const [downloadCaptions, setDownloadCaptions] = useState(true);
  const [extractFramesOnDownload, setExtractFramesOnDownload] = useState(false);
  const [frameRange, setFrameRange] = useState<FrameRangeValues>({
    startSec: "0",
    endSec: "2",
  });
  const [confirmAction, setConfirmAction] = useState<
    ConfirmDialogAction | undefined
  >();

  const runSearch = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;

      startSearchTransition(async () => {
        setError(undefined);
        try {
          setResults(await searchYoutube(trimmed));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Search failed");
        }
      });
    },
    [query, setError],
  );

  const startDownload = useCallback(
    (video: YoutubeSearchResult) => {
      startDownloadTransition(async () => {
        setDownloadingId(video.videoId);
        setError(undefined);
        try {
          const body: Parameters<typeof createYtImport>[0] = {
            videoId: video.videoId,
            storage,
            downloadCaptions,
            extractFrames: extractFramesOnDownload,
          };
          if (extractFramesOnDownload) {
            const range = parseFrameRange(frameRange, video.durationSec);
            body.frameRangeStartSec = range.startSec;
            if (range.endSec != null) body.frameRangeEndSec = range.endSec;
          }

          const created = await createYtImport(body);
          void refresh();
          void navigate({
            to: "/youtube/$importId",
            params: { importId: created._id },
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Download failed");
        } finally {
          setDownloadingId(undefined);
        }
      });
    },
    [
      storage,
      downloadCaptions,
      extractFramesOnDownload,
      frameRange,
      refresh,
      navigate,
      setError,
    ],
  );

  const removeImport = useCallback(
    (id: string) => {
      setConfirmAction({
        title: "Delete YouTube import?",
        body: "Delete this import and all downloaded/extracted assets.",
        confirmLabel: "Delete import",
        variant: "destructive",
        onConfirm: () =>
          deleteYtImport(id)
            .then(refresh)
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : "Delete failed");
            }),
      });
    },
    [refresh, setError],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:p-6">
      <header className="border-b border-border pb-4">
        <h1 className="text-lg font-semibold text-foreground">
          YouTube Import
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search YouTube, download videos locally or to S3, and inspect frames
          with captions.
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Panel>
        <PanelHeader>
          <PanelTitle>Search</PanelTitle>
        </PanelHeader>
        <form
          onSubmit={runSearch}
          className="flex flex-col gap-3 p-3.5 sm:flex-row"
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keywords…"
            className="flex-1"
          />
          <Button
            type="submit"
            variant="default"
            disabled={searchPending || !query.trim()}
          >
            {searchPending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Search size={16} />
            )}
            Search
          </Button>
        </form>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Results
          </h2>
          {results.length === 0 ? (
            <div
              className={cn(
                panelClassName,
                "p-6 text-center text-sm text-muted-foreground",
              )}
            >
              Search for a video to get started.
            </div>
          ) : (
            results.map((video) => (
              <YoutubeSearchResultCard
                key={video.videoId}
                video={video}
                downloading={downloadPending && downloadingId === video.videoId}
                onDownload={startDownload}
              />
            ))
          )}
        </section>

        <aside className="flex flex-col gap-3">
          <Panel>
            <PanelHeader>
              <PanelTitle>Download options</PanelTitle>
            </PanelHeader>
            <div className="flex flex-col gap-3 p-3.5">
              <label className="text-xs font-medium uppercase text-muted-foreground">
                Storage
              </label>
              <Select
                value={storage}
                onChange={(e) => setStorage(e.target.value as YtImportStorage)}
              >
                <option value="local">Local (server storage)</option>
                <option value="s3">S3 (no local copy)</option>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={downloadCaptions}
                  onChange={(e) => setDownloadCaptions(e.target.checked)}
                />
                Download captions
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={extractFramesOnDownload}
                  onChange={(e) => setExtractFramesOnDownload(e.target.checked)}
                />
                Extract frames after download
              </label>
              {extractFramesOnDownload ? (
                <FrameRangeControls
                  values={frameRange}
                  onChange={setFrameRange}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  You can extract frames later on the import detail page with
                  any time range.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                S3 uploads use keys like{" "}
                <code className="rounded bg-muted px-1">
                  yt-imports/VIDEO_ID_title-slug/
                </code>
              </p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Your imports</PanelTitle>
            </PanelHeader>
            <div className="max-h-[420px] overflow-auto p-2">
              {loadingImports ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="animate-spin" size={20} />
                </div>
              ) : imports.length === 0 ? (
                <p className="px-2 py-4 text-sm text-muted-foreground">
                  No downloads yet.
                </p>
              ) : (
                imports.map((item) => (
                  <YtImportListItem
                    key={item._id}
                    item={item}
                    onDelete={removeImport}
                  />
                ))
              )}
            </div>
          </Panel>
        </aside>
      </div>
      <ConfirmDialog
        action={confirmAction}
        busy={loadingImports}
        onClose={() => setConfirmAction(undefined)}
      />
    </div>
  );
}
