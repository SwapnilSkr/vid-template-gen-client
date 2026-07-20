import { useNavigate } from "@tanstack/react-router";
import { Gamepad2, Layers3, Loader2, Search } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import {
  createYtImport,
  createGameplayMix,
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
  const [activeQuery, setActiveQuery] = useState("");
  const [nextPageToken, setNextPageToken] = useState<string>();
  const [mixVideoIds, setMixVideoIds] = useState<Set<string>>(() => new Set());
  const [gameplayTrims, setGameplayTrims] = useState<Record<string, { startSec: string; endSec: string }>>({});
  const [mixTitle, setMixTitle] = useState("");
  const [searchPending, startSearchTransition] = useTransition();
  const [downloadPending, startDownloadTransition] = useTransition();
  const [mixPending, startMixTransition] = useTransition();
  const [downloadingId, setDownloadingId] = useState<string | undefined>();
  const [gameplayId, setGameplayId] = useState<string | undefined>();

  const [storage, setStorage] = useState<YtImportStorage>("local");
  const [downloadCaptions, setDownloadCaptions] = useState(true);
  const [extractFramesOnDownload, setExtractFramesOnDownload] = useState(false);
  /** Baked into muted gameplay segments on “Add as gameplay”. */
  const [gameplaySpeed, setGameplaySpeed] = useState(1);
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
          const page = await searchYoutube(trimmed);
          setActiveQuery(trimmed);
          setResults(page.items);
          setNextPageToken(page.nextPageToken);
          setMixVideoIds(new Set());
          setGameplayTrims({});
        } catch (err) {
          setError(err instanceof Error ? err.message : "Search failed");
        }
      });
    },
    [query, setError],
  );

  const loadMore = useCallback(() => {
    if (!nextPageToken || !activeQuery) return;
    startSearchTransition(async () => {
      setError(undefined);
      try {
        const page = await searchYoutube(activeQuery, 12, nextPageToken);
        setResults((current) => {
          const seen = new Set(current.map((video) => video.videoId));
          return [...current, ...page.items.filter((video) => !seen.has(video.videoId))];
        });
        setNextPageToken(page.nextPageToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load more results");
      }
    });
  }, [activeQuery, nextPageToken, setError]);

  const toggleMixVideo = useCallback((video: YoutubeSearchResult) => {
    setMixVideoIds((current) => {
      const next = new Set(current);
      if (next.has(video.videoId)) next.delete(video.videoId);
      else if (next.size < 8) next.add(video.videoId);
      return next;
    });
  }, []);

  const gameplayTrimFor = useCallback((videoId: string) =>
    gameplayTrims[videoId] ?? { startSec: "0", endSec: "" }, [gameplayTrims]);

  const setGameplayTrim = useCallback((video: YoutubeSearchResult, next: { startSec: string; endSec: string }) => {
    setGameplayTrims((current) => ({ ...current, [video.videoId]: next }));
  }, []);

  const parseGameplayTrim = useCallback((videoId: string) => {
    const raw = gameplayTrims[videoId] ?? { startSec: "0", endSec: "" };
    const startSec = Number(raw.startSec || 0);
    const endSec = raw.endSec === "" ? undefined : Number(raw.endSec);
    if (!Number.isFinite(startSec) || startSec < 0 || (endSec != null && (!Number.isFinite(endSec) || endSec <= startSec))) {
      throw new Error("Gameplay out must be later than gameplay in.");
    }
    return { startSec: startSec || undefined, endSec };
  }, [gameplayTrims]);

  const createMix = useCallback(() => {
    const videoIds = [...mixVideoIds];
    if (videoIds.length < 2) return;
    startMixTransition(async () => {
      setError(undefined);
      try {
        const created = await createGameplayMix({
          sources: videoIds.map((videoId) => ({ videoId, ...parseGameplayTrim(videoId) })),
          title: mixTitle.trim() || undefined,
        });
        void refresh();
        void navigate({ to: "/youtube/$importId", params: { importId: created._id } });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create gameplay mix");
      }
    });
  }, [mixTitle, mixVideoIds, navigate, parseGameplayTrim, refresh, setError]);

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

  const addAsGameplay = useCallback(
    (video: YoutubeSearchResult) => {
      startDownloadTransition(async () => {
        setGameplayId(video.videoId);
        setError(undefined);
        try {
          const created = await createYtImport({
            videoId: video.videoId,
            storage: "s3",
            asGameplay: true,
            gameplaySpeed,
            ...parseGameplayTrim(video.videoId),
          });
          void refresh();
          void navigate({ to: "/youtube/$importId", params: { importId: created._id } });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Gameplay import failed");
        } finally {
          setGameplayId(undefined);
        }
      });
    },
    [gameplaySpeed, navigate, parseGameplayTrim, refresh, setError],
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
          Search YouTube for reference footage, or turn a result directly into
          muted, vertical gameplay clips in your S3 library.
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
                addingAsGameplay={downloadPending && gameplayId === video.videoId}
                selectedForMix={mixVideoIds.has(video.videoId)}
                gameplayTrim={gameplayTrimFor(video.videoId)}
                onDownload={startDownload}
                onAddAsGameplay={addAsGameplay}
                onToggleMixSelection={toggleMixVideo}
                onGameplayTrimChange={setGameplayTrim}
              />
            ))
          )}
          {nextPageToken ? (
            <Button variant="secondary" disabled={searchPending} onClick={loadMore}>
              {searchPending ? <Loader2 className="animate-spin" size={16} /> : null}
              Load more results
            </Button>
          ) : null}
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
              <label className="text-xs font-medium uppercase text-muted-foreground">
                Gameplay speed
              </label>
              <Select
                value={String(gameplaySpeed)}
                onChange={(e) => setGameplaySpeed(Number(e.target.value))}
              >
                <option value="0.25">0.25x (slow-mo)</option>
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1">1x (native)</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x (faster)</option>
              </Select>
              <p className="text-xs text-muted-foreground">
                Applied when you choose Add as gameplay. Raw YouTube download is discarded after the sped muted clip is in S3.
              </p>
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

          <Button variant="secondary" onClick={() => void navigate({ to: "/gameplay" })}>
            <Gamepad2 size={16} />
            Manage gameplay library
          </Button>

          <Panel>
            <PanelHeader>
              <PanelTitle>Gameplay mix</PanelTitle>
            </PanelHeader>
            <div className="flex flex-col gap-3 p-3.5">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Pick 2–8 search results. They will be made vertical, muted, joined in this order, and saved as one independent gameplay asset.
              </p>
              <Input value={mixTitle} onChange={(event) => setMixTitle(event.target.value)} placeholder="Optional mix name" maxLength={100} />
              <Button variant="default" disabled={mixPending || mixVideoIds.size < 2} onClick={createMix}>
                {mixPending ? <Loader2 className="animate-spin" size={16} /> : <Layers3 size={16} />}
                Create mix ({mixVideoIds.size}/8)
              </Button>
              {mixVideoIds.size === 1 ? <p className="m-0 text-xs text-amber-500">Add one more video to create a mix.</p> : null}
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
