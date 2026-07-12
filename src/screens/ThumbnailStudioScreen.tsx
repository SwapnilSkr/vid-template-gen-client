import { getRouteApi, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Clapperboard,
  CloudUpload,
  Download,
  Grid3x3,
  Image as ImageIcon,
  Layers,
  Loader2,
  Redo2,
  RefreshCw,
  Save,
  Shapes,
  Smile,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  discardThumbnailDraft,
  fontFileUrl,
  getReel,
  getThumbnailSource,
  listFonts,
  mediaUrl,
  regenerateThumbnail,
  regenerateReel,
  saveThumbnailDraft,
  saveShortsCover,
  clearShortsCover,
  stageThumbnailDraftImage,
  type FontOption,
  type Reel,
  type Scene,
} from "@/api/reels";
import { ReelStatusChip } from "@/components/reels/ReelStatusChip";
import {
  defaultDoc,
  defaultShapeLayer,
  defaultStickerLayer,
  defaultTextLayer,
  docFromLegacyDraftInput,
  outputSize,
  reviveDoc,
  uid,
  type BackgroundState,
  type ShapeKind,
  type ThumbAspect,
  type ThumbDoc,
  type ThumbLayer,
} from "@/components/thumbnail-editor/doc";
import { EditorStage } from "@/components/thumbnail-editor/EditorStage";
import { useDocHistory } from "@/components/thumbnail-editor/history";
import {
  BackgroundInspector,
  LayersPanel,
  ShapeInspector,
  StickerInspector,
  TextInspector,
} from "@/components/thumbnail-editor/panels";
import { SHAPE_OPTIONS, STICKER_EMOJI, TEXT_STYLE_PRESETS } from "@/components/thumbnail-editor/presets";
import { exportThumbPng } from "@/components/thumbnail-editor/render";
import {
  SourceButton,
  StudioPanel,
  ToolbarButton,
} from "@/components/thumbnail-studio/Chrome";
import {
  AI_PROMPT_CHIPS,
  buildDocFromSavedShortsCover,
  clearShortsSessionDoc,
  defaultTitleText,
  hasSavedShortsCover,
  sessionDocKey,
  shortsSessionDocKey,
} from "@/components/thumbnail-studio/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, type ConfirmDialogAction } from "@/components/ui/confirm-dialog";
import { Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { REEL_ACTIVE_STATUSES, reelNeedsPolling } from "@/utils/reel";

const route = getRouteApi("/studio/$id/thumbnail");

export function ThumbnailStudioScreen() {
  const { id } = route.useParams();
  const { mode } = route.useSearch();
  const isShorts = mode === "shorts";

  const [reel, setReel] = useState<Reel | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmDialogAction | undefined>();
  const [fonts, setFonts] = useState<FontOption[]>([]);
  const [fontsVersion, setFontsVersion] = useState(0);

  const history = useDocHistory(defaultDoc(isShorts ? "9:16" : "16:9", ""));
  const { doc } = history;
  // Synchronously-current doc so patch helpers never act on a stale closure
  // (e.g. two mutations in the same tick, or fast repeated clicks).
  const docRef = history.latestRef;
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [editingId, setEditingId] = useState<string | undefined>();
  const [showGuides, setShowGuides] = useState(true);
  const [addMenu, setAddMenu] = useState<"sticker" | "shape" | undefined>();

  const [bgImage, setBgImage] = useState<HTMLImageElement | undefined>();
  const [bgLoading, setBgLoading] = useState(false);
  const bgCacheRef = useRef(new Map<string, string>());
  const bgRequestRef = useRef(0);

  const [aiPrompt, setAiPrompt] = useState("");
  const initializedRef = useRef<string | undefined>(undefined);
  /** JSON snapshot of the doc at last staging — drives the "out of date" badge. */
  const stagedJsonRef = useRef<string | undefined>(undefined);
  /** Last saved Shorts cover on the server — discard reverts to this. */
  const savedShortsJsonRef = useRef<string | undefined>(undefined);

  // ---- reel loading + polling while generation is active ----
  const refresh = useCallback(async () => {
    try {
      const next = await getReel(id);
      setReel(next);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reel");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const needsPoll = reelNeedsPolling(reel);
  useEffect(() => {
    if (needsPoll) {
      void refresh();
      const t = setInterval(() => void refresh(), 4000);
      return () => clearInterval(t);
    }
    const settle = setTimeout(() => void refresh(), 2000);
    return () => clearTimeout(settle);
  }, [needsPoll, refresh]);

  // ---- fonts: inject @font-face so the canvas matches the bundled faces ----
  useEffect(() => {
    let cancelled = false;
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-thumb-fonts", "1");
    void listFonts()
      .then(async (list) => {
        if (cancelled) return;
        setFonts(list);
        styleEl.textContent = list
          .map(
            (f) =>
              `@font-face{font-family:${JSON.stringify(f.family)};src:url(${JSON.stringify(fontFileUrl(f.file))}) format("truetype");font-display:swap;}`
          )
          .join("\n");
        document.head.appendChild(styleEl);
        await Promise.all(
          list.map((f) =>
            document.fonts.load(`400 48px ${JSON.stringify(f.family)}`).catch(() => undefined)
          )
        );
        if (!cancelled) setFontsVersion((v) => v + 1);
      })
      .catch(() => {
        if (!cancelled) setFonts([]);
      });
    return () => {
      cancelled = true;
      styleEl.remove();
    };
  }, []);

  // ---- one-time doc restore per reel: saved Shorts → session → server draft → fresh ----
  useEffect(() => {
    if (!reel || initializedRef.current === id) return;
    initializedRef.current = id;

    if (isShorts) {
      savedShortsJsonRef.current = undefined;
      const shortsKey = shortsSessionDocKey(id, reel.strategy === "gameplay_overlay");
      const serverSaved = buildDocFromSavedShortsCover(reel);

      let sessionDoc: ThumbDoc | undefined;
      try {
        const raw = sessionStorage.getItem(shortsKey);
        if (raw) {
          const revived = reviveDoc(JSON.parse(raw));
          if (revived) sessionDoc = revived;
        }
      } catch {
        /* corrupted session cache */
      }

      if (serverSaved) {
        const serverJson = JSON.stringify(serverSaved);
        savedShortsJsonRef.current = serverJson;
        if (sessionDoc && JSON.stringify(sessionDoc) !== serverJson) {
          history.replaceAll(sessionDoc);
          return;
        }
        history.replaceAll(serverSaved);
        return;
      }

      if (sessionDoc) {
        history.replaceAll(sessionDoc);
        const fresh = defaultDoc("9:16", defaultTitleText(reel));
        if (reel.strategy === "gameplay_overlay" || !reel.scenes?.length) {
          fresh.background.sourceType = "frame";
        }
        savedShortsJsonRef.current = JSON.stringify(fresh);
        return;
      }
    }

    const cacheKey = sessionDocKey(id);
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const revived = reviveDoc(JSON.parse(raw));
        if (revived) {
          history.replaceAll(revived);
          return;
        }
      }
    } catch {
      /* corrupted session cache — fall through */
    }

    const draftInput = isShorts ? reel.shortsCover?.editorState : reel.thumbnailDraft?.input;
    if (draftInput) {
      const aspect = (isShorts ? "9:16" : (reel.thumbnailDraft?.aspectRatio ?? "16:9")) as ThumbAspect;
      const revived = reviveDoc(draftInput) ?? docFromLegacyDraftInput(draftInput, aspect);
      if (revived) {
        history.replaceAll(revived);
        stagedJsonRef.current = JSON.stringify(revived);
        if (isShorts) savedShortsJsonRef.current = JSON.stringify(revived);
        return;
      }
    }

    // Reddit Shorts are a live-background rendering of the normal thumbnail
    // composition. Import that editor document, but export only its foreground
    // layers/effects so gameplay remains animated underneath.
    if (isShorts && reel.strategy === "gameplay_overlay") {
      try {
        const normalThumbnailDoc = sessionStorage.getItem(sessionDocKey(id));
        const revived = normalThumbnailDoc
          ? reviveDoc(JSON.parse(normalThumbnailDoc))
          : reviveDoc(reel.review?.thumbnailEditorState);
        if (revived?.layers.length) {
          history.replaceAll({ ...revived, aspectRatio: "9:16" });
          return;
        }
      } catch {
        /* no usable conventional-thumbnail editor state */
      }
    }

    // Gameplay / Shorts reels default to vertical — 16:9 customs are often
    // replaced by YouTube's auto 4:5 crop on mobile browse surfaces.
    const defaultAspect: ThumbAspect = isShorts || reel.strategy === "gameplay_overlay" ? "9:16" : "16:9";
    const fresh = defaultDoc(defaultAspect, defaultTitleText(reel));
    if (reel.strategy === "gameplay_overlay" || !reel.scenes?.length) {
      fresh.background.sourceType = "frame";
    } else if (isShorts && reel.thumbnailSceneIndex !== undefined) {
      fresh.background.sourceType = "scene";
      fresh.background.sceneIndex = reel.thumbnailSceneIndex;
    }
    history.replaceAll(fresh);
    if (isShorts) savedShortsJsonRef.current = JSON.stringify(fresh);
  }, [reel, id, history, isShorts]);

  // ---- persist the doc across navigations within the session ----
  useEffect(() => {
    if (initializedRef.current !== id) return;
    const t = window.setTimeout(() => {
      try {
        const key = isShorts
          ? shortsSessionDocKey(id, reel?.strategy === "gameplay_overlay")
          : sessionDocKey(id);
        sessionStorage.setItem(key, JSON.stringify(doc));
      } catch {
        /* quota / private mode */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [doc, id, isShorts, reel?.strategy]);

  useEffect(() => {
    if (!reel?.review?.thumbnailPrompt) return;
    setAiPrompt((current) => current || reel.review?.thumbnailPrompt || "");
  }, [reel?.review?.thumbnailPrompt]);

  // ---- scenes ----
  const scenes = reel?.scenes ?? [];
  const isGameplay = reel?.strategy === "gameplay_overlay";
  const sceneStills = useMemo(
    () =>
      scenes
        .map((scene) => {
          const draftAsset = reel?.editDraft?.sceneAssets.find((item) => item.index === scene.index);
          const url = mediaUrl(draftAsset?.assetUrl) ?? scene.assetUrl;
          return url ? { scene, url } : undefined;
        })
        .filter((item): item is { scene: Scene; url: string } => Boolean(item)),
    [reel?.editDraft?.sceneAssets, scenes]
  );

  const videoDuration = useMemo(() => {
    if (!scenes.length) return 30;
    const fromScenes = Math.max(
      ...scenes.map((scene) => (scene.startTime || 0) + (scene.duration || 0)),
      0
    );
    return fromScenes > 0 ? fromScenes : 30;
  }, [scenes]);

  // Seed the scene index once stills are known. Reads docRef (not the render
  // closure) — this can run in the same effect flush as the draft restore,
  // and a stale closure here would clobber the freshly restored doc.
  useEffect(() => {
    if (initializedRef.current !== id) return;
    const current = docRef.current;
    if (current.background.sourceType !== "scene") return;
    if (current.background.sceneIndex !== undefined) return;
    if (!sceneStills.length) return;
    history.replaceAll({
      ...current,
      background: { ...current.background, sceneIndex: sceneStills[0].scene.index },
    });
  }, [doc, docRef, history, id, sceneStills]);

  // ---- background image fetching (debounced, cached per source key) ----
  const canUseFrame = Boolean(reel?.outputUrl);
  const bg = doc.background;
  const bgSourceKey = useMemo(() => {
    if (bg.sourceType === "frame") {
      return canUseFrame
        ? `frame:${bg.atSeconds.toFixed(1)}:${doc.aspectRatio}:${isShorts && isGameplay ? "clean-gameplay" : "rendered"}`
        : undefined;
    }
    if (bg.sourceType === "scene") {
      return bg.sceneIndex !== undefined && sceneStills.length
        ? `scene:${bg.sceneIndex}:${doc.aspectRatio}`
        : undefined;
    }
    return reel?.review?.thumbnailUrl ? `saved:${reel.review.thumbnailUrl}:${doc.aspectRatio}` : undefined;
  }, [bg.sourceType, bg.atSeconds, bg.sceneIndex, doc.aspectRatio, canUseFrame, sceneStills.length, reel?.review?.thumbnailUrl, isShorts, isGameplay]);

  useEffect(() => {
    if (!reel || !bgSourceKey) {
      setBgImage(undefined);
      return;
    }
    const requestId = ++bgRequestRef.current;
    const cached = bgCacheRef.current.get(bgSourceKey);

    const load = (dataUrl: string) => {
      const img = new Image();
      img.onload = () => {
        if (requestId === bgRequestRef.current) {
          setBgImage(img);
          setBgLoading(false);
        }
      };
      img.src = dataUrl;
    };

    if (cached) {
      load(cached);
      return;
    }

    setBgLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const result = await getThumbnailSource(id, {
          sourceType: bg.sourceType,
          atSeconds: bg.sourceType === "frame" ? Math.max(bg.atSeconds, 0) : undefined,
          sceneIndex: bg.sourceType === "scene" ? bg.sceneIndex : undefined,
          aspectRatio: doc.aspectRatio,
          cleanGameplay: isShorts && isGameplay,
        });
        if (requestId !== bgRequestRef.current) return;
        bgCacheRef.current.set(bgSourceKey, result.imageDataUrl);
        // Frames pile up fast while scrubbing — keep the cache bounded.
        if (bgCacheRef.current.size > 24) {
          const first = bgCacheRef.current.keys().next().value;
          if (first) bgCacheRef.current.delete(first);
        }
        load(result.imageDataUrl);
      } catch (err) {
        if (requestId !== bgRequestRef.current) return;
        setBgLoading(false);
        setError(err instanceof Error ? err.message : "Background fetch failed");
      }
    }, isShorts && isGameplay ? 100 : 260);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgSourceKey, id, Boolean(reel), isShorts, isGameplay]);

  // ---- doc mutation helpers ----
  const applyDoc = useCallback(
    (next: ThumbDoc, commit: boolean) => {
      if (commit) history.commit(next);
      else history.preview(next);
    },
    [history]
  );

  const patchBackground = useCallback(
    (patch: Partial<BackgroundState>, commit = false) => {
      const current = docRef.current;
      applyDoc({ ...current, background: { ...current.background, ...patch } }, commit);
    },
    [applyDoc]
  );

  const patchLayer = useCallback(
    (layerId: string, patch: Partial<ThumbLayer>, commit = false) => {
      const current = docRef.current;
      applyDoc(
        {
          ...current,
          layers: current.layers.map((layer) =>
            layer.id === layerId ? ({ ...layer, ...patch } as ThumbLayer) : layer
          ),
        },
        commit
      );
    },
    [applyDoc]
  );

  const addLayer = useCallback(
    (layer: ThumbLayer) => {
      const current = docRef.current;
      history.commit({ ...current, layers: [...current.layers, layer] });
      setSelectedId(layer.id);
      setAddMenu(undefined);
    },
    [history]
  );

  const duplicateLayer = useCallback(
    (layerId: string) => {
      const current = docRef.current;
      const layer = current.layers.find((l) => l.id === layerId);
      if (!layer) return;
      const copy = {
        ...layer,
        id: uid(),
        x: Math.min(0.95, layer.x + 0.04),
        y: Math.min(0.95, layer.y + 0.05),
      } as ThumbLayer;
      history.commit({ ...current, layers: [...current.layers, copy] });
      setSelectedId(copy.id);
    },
    [history]
  );

  const deleteLayer = useCallback(
    (layerId: string) => {
      const current = docRef.current;
      history.commit({ ...current, layers: current.layers.filter((l) => l.id !== layerId) });
      setSelectedId((c) => (c === layerId ? undefined : c));
      setEditingId((c) => (c === layerId ? undefined : c));
    },
    [history]
  );

  const moveLayer = useCallback(
    (layerId: string, dir: 1 | -1) => {
      const current = docRef.current;
      const index = current.layers.findIndex((l) => l.id === layerId);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= current.layers.length) return;
      const layers = [...current.layers];
      [layers[index], layers[target]] = [layers[target], layers[index]];
      history.commit({ ...current, layers });
    },
    [history]
  );

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === "z") {
        if (inField) return;
        event.preventDefault();
        if (event.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if (meta && event.key.toLowerCase() === "y") {
        if (inField) return;
        event.preventDefault();
        history.redo();
        return;
      }
      if (inField || !selectedId || editingId) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteLayer(selectedId);
        return;
      }
      if (meta && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateLayer(selectedId);
        return;
      }
      const nudge = event.shiftKey ? 0.02 : 0.004;
      const layer = doc.layers.find((l) => l.id === selectedId);
      if (!layer) return;
      const move: Record<string, [number, number]> = {
        ArrowLeft: [-nudge, 0],
        ArrowRight: [nudge, 0],
        ArrowUp: [0, -nudge],
        ArrowDown: [0, nudge],
      };
      const delta = move[event.key];
      if (delta) {
        event.preventDefault();
        patchLayer(
          selectedId,
          {
            x: Math.min(0.99, Math.max(0.01, layer.x + delta[0])),
            y: Math.min(0.99, Math.max(0.01, layer.y + delta[1])),
          },
          true
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteLayer, doc.layers, duplicateLayer, editingId, history, patchLayer, selectedId]);

  // ---- actions ----
  const run = useCallback(async (action: () => Promise<Reel>) => {
    setBusy(true);
    setError(undefined);
    try {
      setReel(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const out = outputSize(doc.aspectRatio);

  const exportDataUrl = useCallback((): string => {
    return exportThumbPng(doc, out.width, out.height, bgImage, {
      transparentBackground: isShorts && isGameplay,
    });
  }, [bgImage, doc, isGameplay, isShorts, out.height, out.width]);

  const stageDraft = useCallback(async (): Promise<Reel> => {
    const imageDataUrl = exportDataUrl();
    const next = await stageThumbnailDraftImage(id, {
      imageDataUrl,
      aspectRatio: doc.aspectRatio,
      editorState: doc as unknown as Record<string, unknown>,
    });
    stagedJsonRef.current = JSON.stringify(doc);
    return next;
  }, [doc, exportDataUrl, id]);

  const uploadFinal = useCallback(
    () =>
      run(async () => {
        await stageDraft();
        return saveThumbnailDraft(id);
      }),
    [id, run, stageDraft]
  );

  const buildFreshShortsDoc = useCallback((): ThumbDoc => {
    if (!reel) return defaultDoc("9:16", "");
    const defaultAspect: ThumbAspect = reel.strategy === "gameplay_overlay" ? "9:16" : "9:16";
    const fresh = defaultDoc(defaultAspect, defaultTitleText(reel));
    if (reel.strategy === "gameplay_overlay" || !reel.scenes?.length) {
      fresh.background.sourceType = "frame";
    } else if (reel.thumbnailSceneIndex !== undefined) {
      fresh.background.sourceType = "scene";
      fresh.background.sceneIndex = reel.thumbnailSceneIndex;
    }
    return fresh;
  }, [reel]);

  const restoreShortsDoc = useCallback(
    (baseline?: ThumbDoc) => {
      if (!reel) return;
      clearShortsSessionDoc(id, reel.strategy === "gameplay_overlay");
      bgCacheRef.current.clear();
      const next = baseline ?? buildFreshShortsDoc();
      history.replaceAll(next);
      savedShortsJsonRef.current = JSON.stringify(next);
      setSelectedId(undefined);
      setEditingId(undefined);
    },
    [buildFreshShortsDoc, history, id, reel]
  );

  const discardUnsavedShortsEdits = useCallback(
    () =>
      run(async () => {
        const latest = await getReel(id);
        const savedDoc = buildDocFromSavedShortsCover(latest);
        if (savedDoc) {
          restoreShortsDoc(savedDoc);
          return latest;
        }
        restoreShortsDoc();
        return latest;
      }),
    [id, restoreShortsDoc, run]
  );

  const removeSavedShortsCover = useCallback(
    () =>
      run(async () => {
        const cleared = await clearShortsCover(id);
        restoreShortsDoc();
        return cleared;
      }),
    [id, restoreShortsDoc, run]
  );

  const uploadShortsCover = useCallback(() => run(async () => {
    const saved = await saveShortsCover(id, {
    imageDataUrl: exportDataUrl(),
    sourceType: isGameplay ? "video_frame" : "scene",
    sceneIndex: isGameplay ? undefined : bg.sceneIndex,
    atSeconds: isGameplay ? bg.atSeconds : undefined,
    placement: "opening",
    holdSeconds: 0.75,
    editorState: doc as unknown as Record<string, unknown>,
    sourceFingerprint: isGameplay
      ? `reddit:${reel?.redditStory?.title ?? reel?.title ?? ""}:${bg.atSeconds.toFixed(1)}`
      : `scene:${bg.sceneIndex ?? "none"}:${sceneStills.find((item) => item.scene.index === bg.sceneIndex)?.url ?? ""}`,
    });
    savedShortsJsonRef.current = JSON.stringify(doc);
    clearShortsSessionDoc(id, Boolean(isGameplay));
    // A completed Reddit reel can apply the cover immediately using only
    // cached narration + FFmpeg. Planned horror reels simply retain it until produce.
    return saved.outputUrl && (isGameplay || saved.assemblyVideoUrl)
      ? regenerateReel(id, "composite_only")
      : saved;
  }), [bg.atSeconds, bg.sceneIndex, doc, exportDataUrl, id, isGameplay, reel?.redditStory?.title, reel?.title, run, sceneStills]);

  useEffect(() => {
    if (!isShorts || !reel) return;
    const saved = buildDocFromSavedShortsCover(reel);
    if (saved) savedShortsJsonRef.current = JSON.stringify(saved);
  }, [isShorts, reel?.shortsCover]);

  const hasSavedShorts = Boolean(reel && hasSavedShortsCover(reel));
  const shortsDirty =
    isShorts &&
    savedShortsJsonRef.current !== undefined &&
    JSON.stringify(doc) !== savedShortsJsonRef.current;

  const downloadPng = useCallback(() => {
    try {
      const a = document.createElement("a");
      a.href = exportDataUrl();
      a.download = `thumbnail-${id}.png`;
      a.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }, [exportDataUrl, id]);

  // ---- derived UI state ----
  if (loading) {
    return (
      <section className="grid place-items-center py-20 text-muted-foreground">
        <Loader2 className="animate-spin" size={26} />
      </section>
    );
  }

  if (!reel) {
    return (
      <section className="px-4 py-6">
        <p className="text-sm text-destructive">{error ?? "Reel not found."}</p>
        <Link to="/studio/$id" params={{ id }} className="text-sm text-primary">
          ← Back to studio
        </Link>
      </section>
    );
  }

  const isGenerating = REEL_ACTIVE_STATUSES.includes(reel.status);
  const hasDraft = Boolean(reel.thumbnailDraft);
  const savedThumbnailUrl = reel.review?.thumbnailUrl;
  const disableEdits = busy || isGenerating;
  const canCompose = Boolean(bgImage);
  const draftStale = hasDraft && stagedJsonRef.current !== JSON.stringify(doc);
  const selectedLayer = selectedId ? doc.layers.find((l) => l.id === selectedId) : undefined;

  const bgMessage =
    bg.sourceType === "frame" && !canUseFrame
      ? "Render the reel first to pull video frames"
      : bg.sourceType === "scene" && !sceneStills.length
        ? "No scene stills yet — switch to a video frame"
        : bg.sourceType === "saved" && !savedThumbnailUrl
          ? "No saved thumbnail yet — generate one with AI first"
          : undefined;

  const stageMaxWidth =
    doc.aspectRatio === "9:16" ? "min(100%, 350px)" : doc.aspectRatio === "1:1" ? "min(100%, 500px)" : "min(100%, 760px)";

  return (
    <section className="studio-workspace w-full min-w-0 overflow-x-clip text-foreground">
      <header className="sticky top-0 z-20 flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to="/studio/$id"
            params={{ id }}
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Back to studio"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <h1 className="m-0 min-w-0 truncate text-sm font-semibold tracking-normal text-foreground">
              {isShorts ? "Shorts Cover Studio" : "Thumbnail studio"} · {reel.title || "Untitled reel"}
            </h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {reel.niche} · <ReelStatusChip status={reel.status} size="sm" />
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isShorts && shortsDirty ? (
            <span className="rounded-full border border-warning/60 bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
              Unsaved Shorts edits
            </span>
          ) : null}
          {hasDraft ? (
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                draftStale
                  ? "border-warning/60 bg-warning/15 text-warning"
                  : "border-warning/40 bg-warning/10 text-warning"
              )}
            >
              {draftStale ? "Draft out of date — re-save" : "Local draft — not uploaded"}
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Refresh"
            onClick={() => void refresh()}
            disabled={busy}
          >
            <RefreshCw size={15} className={isGenerating ? "animate-spin" : undefined} />
          </Button>
        </div>
      </header>

      <div className="px-3 pb-6 pt-3 sm:px-4 lg:px-5">
        {error ? (
          <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        {isShorts && isGameplay ? (
          <div className="mb-3 rounded-lg border border-primary/35 bg-primary/10 px-3 py-2 text-xs leading-relaxed text-primary">
            <strong>Live gameplay overlay:</strong> the gameplay frame is preview-only and is not saved into the cover PNG. The rendered gameplay keeps moving underneath; the existing Reddit title card remains, and only layers or transparent overlay effects added here are composited above it.
          </div>
        ) : null}

        {hasDraft ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm text-warning">
            <div>
              <div className="font-semibold">
                {draftStale ? "Staged draft is out of date" : "Staged thumbnail draft"}
              </div>
              <div className="text-xs">
                {draftStale
                  ? "The canvas changed since staging — re-save before uploading, or discard."
                  : "The composed image lives only on this server. Upload publishes it to S3."}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {draftStale ? (
                <Button
                  type="button"
                  size="default"
                  disabled={disableEdits || !canCompose}
                  onClick={() => void run(stageDraft)}
                >
                  <Save size={15} /> Re-save draft
                </Button>
              ) : (
                <Button
                  type="button"
                  size="default"
                  disabled={busy}
                  onClick={() => void run(() => saveThumbnailDraft(id))}
                >
                  <CloudUpload size={15} /> Upload staged draft
                </Button>
              )}
              <Button
                type="button"
                size="default"
                variant="outline"
                disabled={busy}
                onClick={() => void run(() => discardThumbnailDraft(id))}
              >
                <Trash2 size={15} /> Discard
              </Button>
            </div>
          </div>
        ) : null}

        {isGenerating ? (
          <div className="mb-3 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            Generation is active — thumbnail editing unlocks when the reel settles.
          </div>
        ) : null}

        <div className="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(215px,265px)_minmax(0,1fr)_minmax(300px,345px)]">
          {/* ---- Source + layers rail ---- */}
          <aside className="grid min-w-0 content-start gap-3 xl:sticky xl:top-[61px] xl:max-h-[calc(100vh-73px)] xl:overflow-y-auto xl:pr-1">
            <StudioPanel title="Background" icon={<ImageIcon size={15} />}>
              <div className="grid grid-cols-3 gap-1.5">
                {!isGameplay ? (
                  <SourceButton
                    active={bg.sourceType === "scene"}
                    disabled={disableEdits || sceneStills.length === 0}
                    onClick={() => patchBackground({ sourceType: "scene" }, true)}
                    icon={<ImageIcon size={14} />}
                    label="Scene"
                  />
                ) : null}
                <SourceButton
                  active={bg.sourceType === "frame"}
                  disabled={disableEdits || !canUseFrame}
                  onClick={() => patchBackground({ sourceType: "frame" }, true)}
                  icon={<Clapperboard size={14} />}
                  label="Frame"
                />
                <SourceButton
                  active={bg.sourceType === "saved"}
                  disabled={disableEdits || !savedThumbnailUrl}
                  onClick={() => patchBackground({ sourceType: "saved" }, true)}
                  icon={<Sparkles size={14} />}
                  label="Saved/AI"
                />
              </div>

              {bg.sourceType === "scene" ? (
                sceneStills.length ? (
                  <div className="grid max-h-[38vh] grid-cols-2 gap-2 overflow-y-auto pr-1">
                    {sceneStills.map(({ scene, url }) => (
                      <button
                        key={scene.index}
                        type="button"
                        disabled={disableEdits}
                        onClick={() => patchBackground({ sceneIndex: scene.index }, true)}
                        className={cn(
                          "group overflow-hidden rounded-md border bg-black/45 text-left transition-colors",
                          bg.sceneIndex === scene.index
                            ? "border-primary ring-1 ring-primary/60"
                            : "border-border hover:border-input"
                        )}
                        title={`Use scene ${scene.index + 1} still`}
                      >
                        <img src={url} alt="" className="aspect-video w-full object-cover" />
                        <span className="block truncate px-1.5 py-1 text-[11px] font-medium text-muted-foreground">
                          Scene {scene.index + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/80">
                    No scene stills yet — generate the reel first, or use a video frame.
                  </p>
                )
              ) : null}

              {bg.sourceType === "frame" ? (
                <div className="grid gap-2">
                  <Label className="text-xs text-muted-foreground">
                    Video time — {bg.atSeconds.toFixed(1)}s
                    {bgLoading ? (
                      <span className="ml-2 inline-flex items-center gap-1 text-primary">
                        <Loader2 className="animate-spin" size={11} /> updating
                      </span>
                    ) : null}
                    <input
                      type="range"
                      min={0}
                      max={Math.max(videoDuration, 1)}
                      step={0.1}
                      value={Math.min(bg.atSeconds, Math.max(videoDuration, 1))}
                      disabled={disableEdits || !canUseFrame}
                      onChange={(event) =>
                        patchBackground({ atSeconds: Number(event.target.value) })
                      }
                      onPointerUp={() => patchBackground({}, true)}
                      className="w-full accent-(--color-primary)"
                    />
                  </Label>
                  <p className="text-xs leading-relaxed text-muted-foreground/80">
                    {canUseFrame
                      ? "Scrub to pick a frame — it loads automatically."
                      : "Render the reel to pull frames from the video."}
                  </p>
                </div>
              ) : null}

              {bg.sourceType === "saved" ? (
                <p className="text-xs leading-relaxed text-muted-foreground/80">
                  Editing on top of the currently saved thumbnail — great for adding text to an AI
                  render.
                </p>
              ) : null}
            </StudioPanel>

            <StudioPanel title="Layers" icon={<Layers size={15} />}>
              <LayersPanel
                layers={doc.layers}
                selectedId={selectedId}
                disabled={disableEdits}
                onSelect={(layerId) => setSelectedId(layerId)}
                onToggleHidden={(layerId) => {
                  const layer = doc.layers.find((l) => l.id === layerId);
                  if (layer) patchLayer(layerId, { hidden: !layer.hidden }, true);
                }}
                onDuplicate={duplicateLayer}
                onDelete={deleteLayer}
                onMove={moveLayer}
              />
            </StudioPanel>

            <StudioPanel title="Saved thumbnail" icon={<CloudUpload size={15} />}>
              {savedThumbnailUrl ? (
                <img
                  src={savedThumbnailUrl}
                  alt="Saved thumbnail"
                  className="w-full rounded-md border border-border object-cover"
                />
              ) : (
                <p className="text-xs text-muted-foreground/80">
                  Nothing uploaded yet. The published thumbnail will show here.
                </p>
              )}
              {reel.thumbnailDraft ? (
                <div className="grid gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-warning">
                    Staged draft (local){draftStale ? " · out of date" : ""}
                  </span>
                  <img
                    src={`${mediaUrl(reel.thumbnailDraft.imageUrl)}?v=${encodeURIComponent(reel.thumbnailDraft.id)}`}
                    alt="Staged thumbnail draft"
                    className={cn(
                      "w-full rounded-md border object-cover",
                      draftStale ? "border-warning/60 opacity-60" : "border-warning/50"
                    )}
                  />
                </div>
              ) : null}
            </StudioPanel>
          </aside>

          {/* ---- Canvas column ---- */}
          <main className="grid min-w-0 content-start gap-3">
            <StudioPanel
              title="Canvas"
              icon={<ImageIcon size={15} />}
              actions={
                <span className="rounded-full border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  {doc.aspectRatio} · {out.width}×{out.height}
                </span>
              }
            >
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-2.5">
                <ToolbarButton
                  title="Add text layer"
                  disabled={disableEdits}
                  onClick={() =>
                    addLayer(
                      defaultTextLayer({
                        text: "NEW TEXT",
                        y: 0.5 + (doc.layers.length % 3) * 0.08,
                        ...(TEXT_STYLE_PRESETS.find((p) => p.id === "classic")?.patch ?? {}),
                      })
                    )
                  }
                >
                  <Type size={14} /> Text
                </ToolbarButton>
                <ToolbarButton
                  title="Add emoji sticker"
                  disabled={disableEdits}
                  active={addMenu === "sticker"}
                  onClick={() => setAddMenu((m) => (m === "sticker" ? undefined : "sticker"))}
                >
                  <Smile size={14} /> Sticker
                </ToolbarButton>
                <ToolbarButton
                  title="Add shape"
                  disabled={disableEdits}
                  active={addMenu === "shape"}
                  onClick={() => setAddMenu((m) => (m === "shape" ? undefined : "shape"))}
                >
                  <Shapes size={14} /> Shape
                </ToolbarButton>

                <span className="mx-1 h-5 w-px bg-border" />

                <ToolbarButton
                  title="Undo (⌘Z)"
                  disabled={disableEdits || !history.canUndo}
                  onClick={history.undo}
                >
                  <Undo2 size={14} />
                </ToolbarButton>
                <ToolbarButton
                  title="Redo (⇧⌘Z)"
                  disabled={disableEdits || !history.canRedo}
                  onClick={history.redo}
                >
                  <Redo2 size={14} />
                </ToolbarButton>

                <span className="mx-1 h-5 w-px bg-border" />

                <ToolbarButton
                  title="Toggle composition guides"
                  active={showGuides}
                  onClick={() => setShowGuides((v) => !v)}
                >
                  <Grid3x3 size={14} /> Guides
                </ToolbarButton>

                <div className="ml-auto">
                  <Select
                    disabled={disableEdits}
                    value={doc.aspectRatio}
                    className="min-h-7 w-auto py-1 text-xs"
                    onChange={(event) =>
                      history.commit({ ...doc, aspectRatio: event.target.value as ThumbAspect })
                    }
                  >
                    <option value="9:16">9:16 — Vertical Cover (Reels + Shorts)</option>
                    {!isShorts ? <option value="16:9">16:9 — classic YouTube</option> : null}
                    {!isShorts ? <option value="1:1">1:1 — Square</option> : null}
                  </Select>
                </div>
              </div>

              {addMenu === "sticker" ? (
                <div className="grid grid-cols-10 gap-1 rounded-md border border-border bg-background/50 p-2">
                  {STICKER_EMOJI.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="grid place-items-center rounded p-1 text-xl transition-colors hover:bg-accent"
                      onClick={() => addLayer(defaultStickerLayer(emoji))}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}
              {addMenu === "shape" ? (
                <div className="flex gap-1.5 rounded-md border border-border bg-background/50 p-2">
                  {SHAPE_OPTIONS.map((shape) => (
                    <button
                      key={shape.id}
                      type="button"
                      className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                      onClick={() => addLayer(defaultShapeLayer(shape.id as ShapeKind))}
                    >
                      {shape.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="grid place-items-center bg-black/20 p-4">
                <div style={{ width: stageMaxWidth }}>
                  <EditorStage
                    doc={doc}
                    backgroundImage={bgImage}
                    bgLoading={bgLoading}
                    bgMessage={bgMessage}
                    selectedId={selectedId}
                    editingId={editingId}
                    disabled={disableEdits}
                    showGuides={showGuides}
                    fontsVersion={fontsVersion}
                    onSelect={setSelectedId}
                    onPreview={history.preview}
                    onCommit={history.commit}
                    onEditingChange={(layerId) => {
                      if (!layerId && editingId) history.commit(docRef.current);
                      setEditingId(layerId);
                    }}
                  />
                </div>
              </div>
              <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
                Drag to move · double-click text to type · corners resize · top handle rotates ·
                arrows nudge · ⌘Z undo · ⌫ delete
              </div>
            </StudioPanel>

            <StudioPanel title={isShorts ? "Save Shorts cover" : "Export"} icon={<Save size={15} />}>
              {isShorts ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-border bg-secondary text-foreground hover:bg-accent"
                    disabled={disableEdits || !shortsDirty}
                    onClick={() => void discardUnsavedShortsEdits()}
                  >
                    <Undo2 size={15} />
                    {hasSavedShorts ? "Revert to saved cover" : "Reset editor"}
                  </Button>
                  {reel.shortsCover?.imageUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
                      disabled={disableEdits}
                      onClick={() =>
                        setConfirmAction({
                          title: "Remove saved Shorts cover?",
                          body: "Deletes the saved cover PNG from S3 and resets the editor to a fresh default.",
                          details: [
                            "The next render will not include an opening cover unless you save again.",
                            "Unsaved canvas tweaks in this browser tab are cleared too.",
                          ],
                          confirmLabel: "Remove saved cover",
                          onConfirm: () => void removeSavedShortsCover(),
                        })
                      }
                    >
                      <Trash2 size={15} /> Remove saved cover
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-3">
                {!isShorts ? <Button
                  type="button"
                  variant="outline"
                  className="border-border bg-secondary text-foreground hover:bg-accent"
                  disabled={disableEdits}
                  onClick={downloadPng}
                >
                  <Download size={15} /> Download PNG
                </Button> : null}
                {!isShorts ? <Button
                  type="button"
                  variant="outline"
                  className="border-warning/50 bg-warning/10 text-warning hover:bg-warning/15"
                  disabled={disableEdits || !canCompose}
                  onClick={() => void run(stageDraft)}
                >
                  <Save size={15} /> {draftStale ? "Re-save draft" : "Save draft (local)"}
                </Button> : null}
                <Button
                  type="button"
                  disabled={disableEdits || !canCompose}
                  onClick={() => void (isShorts ? uploadShortsCover() : uploadFinal())}
                >
                  {busy ? <Loader2 className="animate-spin" size={15} /> : <CloudUpload size={15} />}
                  {isShorts ? "Save cover (zero AI)" : "Upload to S3"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground/80">
                {isShorts
                  ? hasSavedShorts
                    ? "Canvas tweaks auto-save in this browser tab until you revert. “Save cover (zero AI)” is what writes the PNG + layout to S3 — Revert restores that last save."
                    : "Canvas tweaks auto-save in this browser tab until you reset. “Save cover (zero AI)” writes the PNG + layout to S3."
                  : "The canvas is rendered in your browser at full resolution — what you see is exactly what uploads. Save keeps one composed PNG on the server until you upload or discard."}
              </p>
            </StudioPanel>
          </main>

          {/* ---- Inspector rail ---- */}
          <div className="grid min-w-0 content-start gap-3 xl:sticky xl:top-[61px] xl:max-h-[calc(100vh-73px)] xl:overflow-y-auto xl:pr-1">
            {selectedLayer?.type === "text" ? (
              <StudioPanel title="Text layer" icon={<Type size={15} />}>
                <TextInspector
                  layer={selectedLayer}
                  fonts={fonts}
                  disabled={disableEdits}
                  onPatch={(patch, commit) => patchLayer(selectedLayer.id, patch, commit)}
                />
              </StudioPanel>
            ) : selectedLayer?.type === "sticker" ? (
              <StudioPanel title="Sticker" icon={<Smile size={15} />}>
                <StickerInspector
                  layer={selectedLayer}
                  disabled={disableEdits}
                  onPatch={(patch, commit) => patchLayer(selectedLayer.id, patch, commit)}
                />
              </StudioPanel>
            ) : selectedLayer?.type === "shape" ? (
              <StudioPanel title="Shape" icon={<Shapes size={15} />}>
                <ShapeInspector
                  layer={selectedLayer}
                  disabled={disableEdits}
                  onPatch={(patch, commit) => patchLayer(selectedLayer.id, patch, commit)}
                />
              </StudioPanel>
            ) : (
              <StudioPanel title="Background & grade" icon={<ImageIcon size={15} />}>
                <BackgroundInspector
                  bg={doc.background}
                  disabled={disableEdits}
                  onPatch={(patch, commit) => patchBackground(patch, commit)}
                />
              </StudioPanel>
            )}

            {!isShorts ? <StudioPanel title="AI thumbnail" icon={<Sparkles size={15} />}>
              <Label className="text-xs text-muted-foreground">
                Prompt
                <Textarea
                  rows={3}
                  disabled={disableEdits}
                  value={aiPrompt}
                  placeholder="Describe the thumbnail scene to generate."
                  onChange={(event) => setAiPrompt(event.target.value)}
                />
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {AI_PROMPT_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={disableEdits}
                    onClick={() =>
                      setAiPrompt((current) => (current ? `${current.trim()}, ${chip}` : chip))
                    }
                    className="rounded-full border border-border bg-secondary px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
                disabled={disableEdits || !aiPrompt.trim()}
                onClick={() =>
                  setConfirmAction({
                    title: "Generate AI thumbnail?",
                    body: "This makes one paid OpenRouter image request, composites the hook text, and uploads the result to S3 as the reel's thumbnail.",
                    details: [
                      "The previous S3 thumbnail is replaced and deleted.",
                      "After it lands, pick “Saved/AI” as the background to add your own layers on top.",
                    ],
                    confirmLabel: "Generate ($)",
                    onConfirm: () =>
                      run(async () => {
                        const review = await regenerateThumbnail(id, {
                          thumbnailPrompt: aiPrompt.trim(),
                        });
                        // The saved thumbnail changed — drop the stale cache entries.
                        for (const key of [...bgCacheRef.current.keys()]) {
                          if (key.startsWith("saved:")) bgCacheRef.current.delete(key);
                        }
                        return { ...reel, review };
                      }),
                  })
                }
              >
                <Wand2 size={15} /> Generate with AI ($)
              </Button>
              {savedThumbnailUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-border bg-secondary text-foreground hover:bg-accent"
                  disabled={disableEdits || bg.sourceType === "saved"}
                  onClick={() => patchBackground({ sourceType: "saved" }, true)}
                >
                  <ImageIcon size={15} /> Edit saved thumbnail on canvas
                </Button>
              ) : null}
              <p className="text-[11px] text-muted-foreground/80">
                AI renders a full thumbnail and saves it to S3. Pull it back onto the canvas to
                stack your own headline, stickers, and grading on top.
              </p>
            </StudioPanel> : null}
          </div>
        </div>
      </div>

      <ConfirmDialog action={confirmAction} busy={busy} onClose={() => setConfirmAction(undefined)} />
    </section>
  );
}
