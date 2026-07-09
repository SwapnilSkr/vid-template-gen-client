import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Loader2, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { outputSize, type TextLayer, type ThumbDoc, type ThumbLayer } from "./doc";
import { measureTextLayer, renderThumbDoc, type LayerBox } from "./render";

// ============================================
// EditorStage — canvas preview + direct manipulation.
//
// The canvas is drawn by the same pure renderer used for export, so the stage
// is pixel-true. Selection, drag/resize/rotate handles, and inline text
// editing are DOM overlays positioned from the renderer's hit boxes.
// Text layers are edited through a controlled <textarea> (never
// contentEditable), so typing can't be clobbered by re-renders.
// ============================================

interface EditorStageProps {
  doc: ThumbDoc;
  backgroundImage: HTMLImageElement | undefined;
  bgLoading: boolean;
  bgMessage?: string;
  selectedId: string | undefined;
  editingId: string | undefined;
  disabled: boolean;
  showGuides: boolean;
  /** Bumped when webfonts finish loading so text re-measures. */
  fontsVersion: number;
  onSelect: (id: string | undefined) => void;
  onPreview: (doc: ThumbDoc) => void;
  onCommit: (doc: ThumbDoc) => void;
  onEditingChange: (id: string | undefined) => void;
}

type DragMode = "move" | "scale" | "rotate" | "width" | "pan-bg";

interface DragState {
  mode: DragMode;
  pointerId: number;
  startX: number;
  startY: number;
  startDoc: ThumbDoc;
  layerId?: string;
  startBox?: LayerBox;
  lastDoc: ThumbDoc;
  moved: boolean;
}

const SNAP_TARGETS_X = [0.5];
const SNAP_TARGETS_Y = [0.5];
const SNAP_PX = 8;

export function EditorStage({
  doc,
  backgroundImage,
  bgLoading,
  bgMessage,
  selectedId,
  editingId,
  disabled,
  showGuides,
  fontsVersion,
  onSelect,
  onPreview,
  onCommit,
  onEditingChange,
}: EditorStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const measureCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const boxesRef = useRef<LayerBox[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const [stageSize, setStageSize] = useState({ w: 640, h: 360 });
  const [boxVersion, setBoxVersion] = useState(0);
  const [snapLines, setSnapLines] = useState<{ x?: number; y?: number }>({});
  const editRef = useRef<HTMLTextAreaElement | null>(null);

  const out = outputSize(doc.aspectRatio);
  const scale = stageSize.w / out.width;

  // ---- stage sizing ----
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const sync = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) setStageSize({ w: rect.width, h: rect.height });
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- draw ----
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const pxW = Math.max(1, Math.round(stageSize.w * dpr));
    const pxH = Math.max(1, Math.round(stageSize.h * dpr));
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW;
      canvas.height = pxH;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    boxesRef.current = renderThumbDoc(ctx, doc, out.width, out.height, {
      backgroundImage,
      skipLayerId: editingId,
    });
    setBoxVersion((v) => v + 1);
  }, [doc, backgroundImage, stageSize, scale, out.width, out.height, editingId, fontsVersion]);

  // ---- coordinate helpers ----
  const toOutputSpace = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: ((clientX - rect.left) / rect.width) * out.width,
        y: ((clientY - rect.top) / rect.height) * out.height,
      };
    },
    [out.width, out.height]
  );

  const hitTest = useCallback((x: number, y: number): LayerBox | undefined => {
    const boxes = boxesRef.current;
    for (let i = boxes.length - 1; i >= 0; i--) {
      const box = boxes[i];
      const rad = (-box.rotation * Math.PI) / 180;
      const dx = x - box.cx;
      const dy = y - box.cy;
      const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
      if (Math.abs(lx) <= box.w / 2 + 6 && Math.abs(ly) <= box.h / 2 + 6) return box;
    }
    return undefined;
  }, []);

  const patchLayer = useCallback(
    (base: ThumbDoc, layerId: string, patch: Partial<ThumbLayer>): ThumbDoc => ({
      ...base,
      layers: base.layers.map((layer) =>
        layer.id === layerId ? ({ ...layer, ...patch } as ThumbLayer) : layer
      ),
    }),
    []
  );

  // ---- dragging ----
  const applyDrag = useCallback(
    (drag: DragState, clientX: number, clientY: number): ThumbDoc => {
      const start = drag.startDoc;
      const dxPx = ((clientX - drag.startX) / stageSize.w) * out.width;
      const dyPx = ((clientY - drag.startY) / stageSize.h) * out.height;

      if (drag.mode === "pan-bg") {
        const bg = start.background;
        const denomX = out.width * Math.max(bg.zoom - 1, 0.0001);
        const denomY = out.height * Math.max(bg.zoom - 1, 0.0001);
        return {
          ...start,
          background: {
            ...bg,
            offsetX: clamp(bg.offsetX + (dxPx / denomX) * 2, -1, 1),
            offsetY: clamp(bg.offsetY + (dyPx / denomY) * 2, -1, 1),
          },
        };
      }

      const layerId = drag.layerId;
      const layer = layerId ? start.layers.find((l) => l.id === layerId) : undefined;
      const box = drag.startBox;
      if (!layer || !box || !layerId) return start;

      if (drag.mode === "move") {
        let nx = clamp(layer.x + dxPx / out.width, 0.01, 0.99);
        let ny = clamp(layer.y + dyPx / out.height, 0.01, 0.99);
        // 8 screen px expressed as a fraction of the stage width.
        const snapTol = SNAP_PX / (stageSize.w || 1);
        const lines: { x?: number; y?: number } = {};
        for (const t of SNAP_TARGETS_X) {
          if (Math.abs(nx - t) < snapTol) {
            nx = t;
            lines.x = t;
          }
        }
        for (const t of SNAP_TARGETS_Y) {
          if (Math.abs(ny - t) < snapTol) {
            ny = t;
            lines.y = t;
          }
        }
        setSnapLines(lines);
        return patchLayer(start, layerId, { x: nx, y: ny });
      }

      if (drag.mode === "scale") {
        const startDist = Math.hypot(
          toOutputSpace(drag.startX, drag.startY).x - box.cx,
          toOutputSpace(drag.startX, drag.startY).y - box.cy
        );
        const nowPos = toOutputSpace(clientX, clientY);
        const nowDist = Math.hypot(nowPos.x - box.cx, nowPos.y - box.cy);
        const ratio = clamp(nowDist / Math.max(startDist, 8), 0.2, 5);
        if (layer.type === "text") {
          return patchLayer(start, layerId, {
            sizePct: clamp(layer.sizePct * ratio, 0.02, 0.4),
          } as Partial<TextLayer>);
        }
        if (layer.type === "sticker") {
          return patchLayer(start, layerId, { sizePct: clamp(layer.sizePct * ratio, 0.03, 0.9) });
        }
        return patchLayer(start, layerId, {
          wPct: clamp(layer.wPct * ratio, 0.03, 1.4),
          hPct: clamp(layer.hPct * ratio, 0.008, 1.4),
        });
      }

      if (drag.mode === "rotate") {
        const now = toOutputSpace(clientX, clientY);
        const angle = (Math.atan2(now.y - box.cy, now.x - box.cx) * 180) / Math.PI + 90;
        let rot = ((angle + 180) % 360) - 180;
        const snapped = Math.round(rot / 15) * 15;
        if (Math.abs(rot - snapped) < 4) rot = snapped;
        return patchLayer(start, layerId, { rotation: Math.round(rot * 10) / 10 });
      }

      if (drag.mode === "width") {
        if (layer.type === "text") {
          return patchLayer(start, layerId, {
            widthPct: clamp(layer.widthPct + (dxPx / out.width) * 2, 0.15, 1),
          } as Partial<TextLayer>);
        }
        if (layer.type === "shape") {
          return patchLayer(start, layerId, {
            wPct: clamp(layer.wPct + (dxPx / out.width) * 2, 0.03, 1.4),
          });
        }
      }
      return start;
    },
    [out.height, out.width, patchLayer, stageSize.h, stageSize.w, toOutputSpace]
  );

  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    setSnapLines({});
    if (drag?.moved) onCommit(drag.lastDoc);
  }, [onCommit]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const next = applyDrag(drag, event.clientX, event.clientY);
      drag.lastDoc = next;
      drag.moved = true;
      onPreview(next);
    };
    const onUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      endDrag();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [applyDrag, endDrag, onPreview]);

  const beginDrag = useCallback(
    (mode: DragMode, event: React.PointerEvent, layerId?: string) => {
      if (disabled) return;
      event.preventDefault();
      event.stopPropagation();
      const box = layerId ? boxesRef.current.find((b) => b.id === layerId) : undefined;
      dragRef.current = {
        mode,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startDoc: doc,
        layerId,
        startBox: box,
        lastDoc: doc,
        moved: false,
      };
    },
    [disabled, doc]
  );

  const onStagePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (disabled) return;
      if (editingId) {
        // Clicking outside the inline editor commits it.
        if (event.target !== editRef.current) onEditingChange(undefined);
        return;
      }
      const pos = toOutputSpace(event.clientX, event.clientY);
      const hit = hitTest(pos.x, pos.y);
      if (hit) {
        onSelect(hit.id);
        beginDrag("move", event, hit.id);
      } else {
        onSelect(undefined);
        if (doc.background.zoom > 1.001) beginDrag("pan-bg", event);
      }
    },
    [beginDrag, disabled, doc.background.zoom, editingId, hitTest, onEditingChange, onSelect, toOutputSpace]
  );

  const onStageDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (disabled) return;
      const pos = toOutputSpace(event.clientX, event.clientY);
      const hit = hitTest(pos.x, pos.y);
      const layer = hit && doc.layers.find((l) => l.id === hit.id);
      if (layer?.type === "text") {
        onSelect(layer.id);
        onEditingChange(layer.id);
      }
    },
    [disabled, doc.layers, hitTest, onEditingChange, onSelect, toOutputSpace]
  );

  // ---- inline text editing ----
  const editingLayer = useMemo(
    () =>
      editingId
        ? (doc.layers.find((l) => l.id === editingId && l.type === "text") as TextLayer | undefined)
        : undefined,
    [doc.layers, editingId]
  );

  useEffect(() => {
    if (editingLayer) {
      const el = editRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    }
  }, [editingLayer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const measureCtx = () => {
    if (!measureCtxRef.current) {
      measureCtxRef.current = document.createElement("canvas").getContext("2d");
    }
    return measureCtxRef.current;
  };

  // Box of the editing layer, freshly measured so the textarea tracks growth.
  const editingBox = useMemo(() => {
    if (!editingLayer) return undefined;
    const ctx = measureCtx();
    if (!ctx) return undefined;
    const m = measureTextLayer(ctx, editingLayer, out.width);
    return {
      cx: editingLayer.x * out.width,
      cy: editingLayer.y * out.height,
      w: Math.max(editingLayer.widthPct * out.width, m.blockW),
      h: m.blockH,
      fontPx: m.fontPx,
    };
  }, [editingLayer, out.width, out.height, fontsVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedBox = useMemo(() => {
    void boxVersion;
    return selectedId ? boxesRef.current.find((b) => b.id === selectedId) : undefined;
  }, [selectedId, boxVersion]);

  const selectedLayer = selectedId ? doc.layers.find((l) => l.id === selectedId) : undefined;

  return (
    <div
      ref={containerRef}
      className="relative w-full touch-none select-none overflow-hidden rounded-md border border-border bg-black"
      style={{ aspectRatio: doc.aspectRatio.replace(":", " / ") }}
      onPointerDown={onStagePointerDown}
      onDoubleClick={onStageDoubleClick}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {bgLoading ? (
        <div className="absolute left-2 top-2 z-20 inline-flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-[11px] font-medium text-white/90">
          <Loader2 className="animate-spin" size={11} /> updating background…
        </div>
      ) : null}

      {!backgroundImage && !bgLoading ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-xs font-semibold text-white/45">
          {bgMessage ?? "Pick a background source to start"}
        </div>
      ) : null}

      {/* Composition guides */}
      {showGuides && !editingId ? (
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="absolute inset-y-0 left-1/3 w-px bg-white/12" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-white/12" />
          <div className="absolute inset-x-0 top-1/3 h-px bg-white/12" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-white/12" />
          <div className="absolute inset-[4%] rounded border border-dashed border-white/15" />
          {/* YouTube duration badge zone */}
          {doc.aspectRatio === "16:9" ? (
            <div className="absolute bottom-[4%] right-[3%] flex h-[11%] w-[17%] items-center justify-center rounded-sm border border-dashed border-red-400/50 bg-red-500/10">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-red-300/80">
                duration
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Snap lines */}
      {snapLines.x !== undefined ? (
        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-px bg-primary"
          style={{ left: `${snapLines.x * 100}%` }}
        />
      ) : null}
      {snapLines.y !== undefined ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 h-px bg-primary"
          style={{ top: `${snapLines.y * 100}%` }}
        />
      ) : null}

      {/* Selection + handles */}
      {selectedBox && selectedLayer && !editingId && !disabled ? (
        <div
          className="pointer-events-none absolute z-20"
          style={{
            left: selectedBox.cx * scale,
            top: selectedBox.cy * scale,
            width: selectedBox.w * scale,
            height: selectedBox.h * scale,
            transform: `translate(-50%, -50%) rotate(${selectedBox.rotation}deg)`,
          }}
        >
          <div className="absolute -inset-1 rounded-sm border-2 border-primary/85 shadow-[0_0_0_1px_rgba(0,0,0,0.6)]" />

          {/* Rotate */}
          <div
            className="pointer-events-auto absolute -top-9 left-1/2 grid size-6 -translate-x-1/2 cursor-grab place-items-center rounded-full border border-primary bg-background text-primary shadow-md active:cursor-grabbing"
            title="Drag to rotate (snaps every 15°)"
            onPointerDown={(e) => beginDrag("rotate", e, selectedLayer.id)}
          >
            <RotateCw size={13} />
          </div>
          <div className="absolute -top-3.5 left-1/2 h-2.5 w-px -translate-x-1/2 bg-primary/70" />

          {/* Corner scale handles */}
          {(["-top-2 -left-2", "-top-2 -right-2", "-bottom-2 -left-2", "-bottom-2 -right-2"] as const).map(
            (pos) => (
              <div
                key={pos}
                className={cn(
                  "pointer-events-auto absolute size-3.5 rounded-full border-2 border-background bg-primary shadow-md",
                  pos,
                  pos.includes("-top-2 -left-2") || pos.includes("-bottom-2 -right-2")
                    ? "cursor-nwse-resize"
                    : "cursor-nesw-resize"
                )}
                title="Drag to resize"
                onPointerDown={(e) => beginDrag("scale", e, selectedLayer.id)}
              />
            )
          )}

          {/* Wrap width handle (text + shapes) */}
          {selectedLayer.type !== "sticker" ? (
            <div
              className="pointer-events-auto absolute top-1/2 -right-2.5 h-7 w-2.5 -translate-y-1/2 cursor-ew-resize rounded-full border border-background bg-primary shadow-md"
              title={selectedLayer.type === "text" ? "Drag to change wrap width" : "Drag to change width"}
              onPointerDown={(e) => beginDrag("width", e, selectedLayer.id)}
            />
          ) : null}
        </div>
      ) : null}

      {/* Inline text editor — controlled textarea, pixel-matched to the canvas */}
      {editingLayer && editingBox ? (
        <textarea
          ref={editRef}
          value={editingLayer.text}
          spellCheck={false}
          className="absolute z-30 resize-none overflow-hidden border-2 border-dashed border-primary/80 bg-black/25 outline-none backdrop-blur-[1px]"
          style={{
            left: (editingBox.cx - editingBox.w / 2) * scale - 8,
            top: (editingBox.cy - editingBox.h / 2) * scale - 8,
            width: editingBox.w * scale + 16,
            height: Math.max(editingBox.h * scale + 16, editingBox.fontPx * scale * 1.4),
            fontFamily: editingLayer.fontFamily.includes(",")
              ? editingLayer.fontFamily
              : `"${editingLayer.fontFamily}"`,
            fontSize: editingBox.fontPx * scale,
            lineHeight: `${editingLayer.lineHeight}`,
            textAlign: editingLayer.align,
            textTransform: editingLayer.uppercase ? "uppercase" : "none",
            color: editingLayer.fill.type === "gradient" ? (editingLayer.fill.from ?? "#fff") : editingLayer.fill.color,
            WebkitTextStroke:
              editingLayer.strokePct > 0
                ? `${Math.max(0.5, editingLayer.strokePct * editingBox.fontPx * scale * 0.5)}px ${editingLayer.strokeColor}`
                : undefined,
            caretColor: "#fff",
          }}
          onChange={(event) =>
            onPreview({
              ...doc,
              layers: doc.layers.map((l) =>
                l.id === editingLayer.id ? { ...l, text: event.target.value } : l
              ),
            })
          }
          onBlur={() => onEditingChange(undefined)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape" || (event.key === "Enter" && (event.metaKey || event.ctrlKey))) {
              event.preventDefault();
              onEditingChange(undefined);
            }
          }}
          onPointerDown={(event) => event.stopPropagation()}
        />
      ) : null}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
