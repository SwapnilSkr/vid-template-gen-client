import type { BackgroundState, ShapeLayer, StickerLayer, TextLayer, ThumbDoc, ThumbLayer } from "./doc";
import { OVERLAY_PRESETS } from "./presets";

// ============================================
// Pure canvas renderer. The live editor stage and the full-resolution PNG
// export both call renderThumbDoc, so the preview IS the upload — no server
// round-trip, no drift. Works in output-pixel space; the caller scales the
// context. Returns per-layer bounding boxes for hit-testing and selection.
// ============================================

export interface LayerBox {
  id: string;
  /** Center + size in output px (pre-rotation). */
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotation: number;
}

export interface RenderOptions {
  backgroundImage?: HTMLImageElement | undefined;
  /** Export foreground layers/effects over alpha while the editor can still
   * preview them against a reference frame. Used for live Reddit gameplay. */
  transparentBackground?: boolean;
  /** Layer being inline-edited on the stage — skipped so the DOM editor replaces it. */
  skipLayerId?: string;
}

export function renderThumbDoc(
  ctx: CanvasRenderingContext2D,
  doc: ThumbDoc,
  outW: number,
  outH: number,
  options: RenderOptions = {}
): LayerBox[] {
  ctx.save();
  ctx.clearRect(0, 0, outW, outH);
  if (!options.transparentBackground) {
    ctx.fillStyle = "#0a0a0c";
    ctx.fillRect(0, 0, outW, outH);
  }

  drawBackground(
    ctx,
    doc.background,
    outW,
    outH,
    options.transparentBackground ? undefined : options.backgroundImage,
  );

  const boxes: LayerBox[] = [];
  for (const layer of doc.layers) {
    if (layer.hidden) continue;
    const box =
      layer.type === "text"
        ? drawTextLayer(ctx, layer, outW, outH, options.skipLayerId === layer.id)
        : layer.type === "sticker"
          ? drawStickerLayer(ctx, layer, outW, outH)
          : drawShapeLayer(ctx, layer, outW, outH);
    boxes.push(box);
  }

  ctx.restore();
  return boxes;
}

// ---------- background ----------

function drawBackground(
  ctx: CanvasRenderingContext2D,
  bg: BackgroundState,
  outW: number,
  outH: number,
  image: HTMLImageElement | undefined
): void {
  if (image && image.naturalWidth > 0) {
    const zoom = Math.max(1, bg.zoom);
    // Cover-fit, then zoom; offsets pan across the overflow.
    const scale = Math.max(outW / image.naturalWidth, outH / image.naturalHeight) * zoom;
    const drawW = image.naturalWidth * scale;
    const drawH = image.naturalHeight * scale;
    const overX = (drawW - outW) / 2;
    const overY = (drawH - outH) / 2;
    const dx = (outW - drawW) / 2 + clamp(bg.offsetX, -1, 1) * overX;
    const dy = (outH - drawH) / 2 + clamp(bg.offsetY, -1, 1) * overY;

    ctx.save();
    const filters: string[] = [];
    if (bg.brightness !== 1) filters.push(`brightness(${bg.brightness})`);
    if (bg.contrast !== 1) filters.push(`contrast(${bg.contrast})`);
    if (bg.saturation !== 1) filters.push(`saturate(${bg.saturation})`);
    if (bg.hue !== 0) filters.push(`hue-rotate(${bg.hue}deg)`);
    if (bg.grayscale > 0) filters.push(`grayscale(${bg.grayscale})`);
    if (bg.sepia > 0) filters.push(`sepia(${bg.sepia})`);
    if (bg.blur > 0) filters.push(`blur(${bg.blur}px)`);
    if (filters.length) ctx.filter = filters.join(" ");
    if (bg.flipH) {
      ctx.translate(outW, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(image, outW - dx - drawW, dy, drawW, drawH);
    } else {
      ctx.drawImage(image, dx, dy, drawW, drawH);
    }
    ctx.restore();
  }

  // Temperature: warm/cool cast blended over the image.
  if (bg.temperature !== 0) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = Math.min(0.5, Math.abs(bg.temperature) * 0.45);
    ctx.fillStyle = bg.temperature > 0 ? "#ff9a3c" : "#3c8dff";
    ctx.fillRect(0, 0, outW, outH);
    ctx.restore();
  }

  // Gradient overlay preset.
  const overlay = OVERLAY_PRESETS.find((o) => o.id === bg.overlayId);
  if (overlay && overlay.kind !== "none" && bg.overlayOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(bg.overlayOpacity, 0, 1);
    let fill: CanvasGradient;
    if (overlay.kind === "edges") {
      fill = ctx.createRadialGradient(
        outW / 2, outH / 2, Math.min(outW, outH) * 0.3,
        outW / 2, outH / 2, Math.max(outW, outH) * 0.72
      );
    } else if (overlay.kind === "diagonal") {
      fill = ctx.createLinearGradient(0, 0, outW, outH);
    } else if (overlay.kind === "top" || overlay.kind === "bottom") {
      fill = ctx.createLinearGradient(0, 0, 0, outH);
    } else {
      fill = ctx.createLinearGradient(0, 0, 0, outH);
    }
    fill.addColorStop(0, overlay.colors[0]);
    fill.addColorStop(1, overlay.colors[1]);
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, outW, outH);
    ctx.restore();
  }

  // Vignette.
  if (bg.vignette > 0) {
    ctx.save();
    const v = ctx.createRadialGradient(
      outW / 2, outH / 2, Math.min(outW, outH) * 0.42,
      outW / 2, outH / 2, Math.max(outW, outH) * 0.78
    );
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, `rgba(0,0,0,${clamp(bg.vignette, 0, 1) * 0.85})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, outW, outH);
    ctx.restore();
  }

  // Film grain.
  if (bg.grain > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = clamp(bg.grain, 0, 1) * 0.55;
    const pattern = ctx.createPattern(grainTile(), "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, outW, outH);
    }
    ctx.restore();
  }
}

let grainCanvas: HTMLCanvasElement | undefined;
function grainTile(): HTMLCanvasElement {
  if (grainCanvas) return grainCanvas;
  const size = 160;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const gctx = canvas.getContext("2d")!;
  const data = gctx.createImageData(size, size);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  gctx.putImageData(data, 0, 0);
  grainCanvas = canvas;
  return canvas;
}

// ---------- text ----------

export interface TextMetricsResult {
  lines: string[];
  lineWidths: number[];
  fontPx: number;
  lineHeightPx: number;
  blockW: number;
  blockH: number;
}

/** Shared by the renderer and the stage's inline editor so the DOM textarea
 *  and the canvas agree about wrapping and block size. */
export function measureTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  outW: number
): TextMetricsResult {
  const fontPx = Math.max(8, layer.sizePct * outW);
  applyFont(ctx, layer, fontPx);
  const maxWidth = Math.max(40, layer.widthPct * outW);
  const raw = layer.uppercase ? layer.text.toUpperCase() : layer.text;

  const lines: string[] = [];
  for (const paragraph of raw.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
  }

  const lineWidths = lines.map((line) => ctx.measureText(line).width);
  const lineHeightPx = fontPx * layer.lineHeight;
  const blockW = Math.max(...lineWidths, fontPx * 0.5);
  const blockH = Math.max(lines.length, 1) * lineHeightPx;
  return { lines, lineWidths, fontPx, lineHeightPx, blockW, blockH };
}

function applyFont(ctx: CanvasRenderingContext2D, layer: TextLayer, fontPx: number): void {
  ctx.font = `${fontPx}px ${quoteFamily(layer.fontFamily)}`;
  try {
    // Chrome/Safari 17+; harmless no-op elsewhere.
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing =
      `${layer.letterSpacing * fontPx}px`;
  } catch {
    /* older engines */
  }
}

function quoteFamily(family: string): string {
  if (!family) return "sans-serif";
  // Already a stack ("Impact, sans-serif") — pass through.
  if (family.includes(",") || family.includes("'") || family.includes('"')) return family;
  return `"${family}"`;
}

function drawTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  outW: number,
  outH: number,
  skip: boolean
): LayerBox {
  const m = measureTextLayer(ctx, layer, outW);
  const cx = layer.x * outW;
  const cy = layer.y * outH;
  const pad = layer.bgPadPct * m.fontPx;
  const box: LayerBox = {
    id: layer.id,
    cx,
    cy,
    w: m.blockW + pad * 2,
    h: m.blockH + pad * 1.2,
    rotation: layer.rotation,
  };
  if (skip || !layer.text) return box;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.globalAlpha = clamp(layer.opacity, 0, 1);
  applyFont(ctx, layer, m.fontPx);
  ctx.textBaseline = "middle";
  ctx.textAlign = layer.align;

  // textAlign does the per-line work; the anchor sits on the block edge.
  const alignX = () =>
    layer.align === "left" ? -m.blockW / 2 : layer.align === "right" ? m.blockW / 2 : 0;
  const lineY = (index: number) => -m.blockH / 2 + m.lineHeightPx * (index + 0.5);

  // Backing pills per line.
  if (layer.bgOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(layer.opacity, 0, 1) * clamp(layer.bgOpacity, 0, 1);
    ctx.fillStyle = layer.bgColor;
    const radius = clamp(layer.bgRadiusPct, 0, 0.5) * m.lineHeightPx;
    for (let i = 0; i < m.lines.length; i++) {
      if (!m.lines[i]) continue;
      const w = m.lineWidths[i] + pad * 2;
      const h = m.lineHeightPx + pad * 0.4;
      const x =
        layer.align === "left"
          ? -m.blockW / 2 - pad
          : layer.align === "right"
            ? m.blockW / 2 - w + pad
            : -w / 2;
      roundRect(ctx, x, lineY(i) - h / 2, w, h, radius);
      ctx.fill();
    }
    ctx.restore();
  }

  const strokePx = layer.strokePct * m.fontPx;

  // Fill style — vertical gradient spans the text block.
  let fillStyle: string | CanvasGradient = layer.fill.color;
  if (layer.fill.type === "gradient") {
    const g = ctx.createLinearGradient(0, -m.blockH / 2, 0, m.blockH / 2);
    g.addColorStop(0, layer.fill.from ?? layer.fill.color);
    g.addColorStop(1, layer.fill.to ?? layer.fill.color);
    fillStyle = g;
  }

  const eachLine = (draw: (line: string, x: number, y: number) => void) => {
    for (let i = 0; i < m.lines.length; i++) {
      if (!m.lines[i]) continue;
      draw(m.lines[i], alignX(), lineY(i));
    }
  };

  // 1) Outer glow — multiple soft passes behind everything.
  if (layer.glowStrength > 0) {
    ctx.save();
    ctx.shadowColor = layer.glowColor;
    ctx.fillStyle = layer.glowColor;
    const passes = layer.glowStrength > 0.6 ? 3 : 2;
    for (let p = 0; p < passes; p++) {
      ctx.shadowBlur = m.fontPx * (0.12 + 0.22 * (p + 1)) * layer.glowStrength;
      eachLine((line, x, y) => ctx.fillText(line, x, y));
    }
    ctx.restore();
  }

  // 2) Glitch copies — offset red/cyan duplicates.
  if (layer.glitch) {
    const d = Math.max(2, m.fontPx * 0.045);
    ctx.save();
    ctx.globalAlpha = clamp(layer.opacity, 0, 1) * 0.85;
    ctx.fillStyle = "#ff004c";
    eachLine((line, x, y) => ctx.fillText(line, x - d, y - d * 0.4));
    ctx.fillStyle = "#00e5ff";
    eachLine((line, x, y) => ctx.fillText(line, x + d, y + d * 0.4));
    ctx.restore();
  }

  // 3) 3D extrusion — stacked solid offsets.
  if (layer.extrudeDepthPct > 0) {
    const depth = Math.max(1, Math.round(layer.extrudeDepthPct * m.fontPx));
    ctx.save();
    ctx.fillStyle = layer.extrudeColor;
    for (let i = depth; i >= 1; i--) {
      eachLine((line, x, y) => ctx.fillText(line, x + i, y + i));
    }
    ctx.restore();
  }

  // 4) Drop shadow rides on the stroke+fill passes.
  const hasShadow = layer.shadowBlurPct > 0 || layer.shadowXPct !== 0 || layer.shadowYPct !== 0;
  if (hasShadow) {
    ctx.shadowColor = layer.shadowColor;
    ctx.shadowBlur = layer.shadowBlurPct * m.fontPx;
    ctx.shadowOffsetX = layer.shadowXPct * m.fontPx;
    ctx.shadowOffsetY = layer.shadowYPct * m.fontPx;
  }

  // 5) Stroke under fill (paint-order: stroke) so heavy outlines don't eat glyphs.
  if (strokePx > 0) {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.lineWidth = strokePx * 2;
    ctx.strokeStyle = layer.strokeColor;
    eachLine((line, x, y) => ctx.strokeText(line, x, y));
    ctx.restore();
    // Shadow already painted by the stroke pass — avoid doubling on fill.
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  // 6) Fill.
  ctx.fillStyle = fillStyle;
  eachLine((line, x, y) => ctx.fillText(line, x, y));

  ctx.restore();
  return box;
}

// ---------- stickers ----------

function drawStickerLayer(
  ctx: CanvasRenderingContext2D,
  layer: StickerLayer,
  outW: number,
  outH: number
): LayerBox {
  const px = Math.max(12, layer.sizePct * outW);
  const cx = layer.x * outW;
  const cy = layer.y * outH;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.globalAlpha = clamp(layer.opacity, 0, 1);
  ctx.font = `${px}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (layer.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = px * 0.12;
    ctx.shadowOffsetY = px * 0.06;
  }
  ctx.fillText(layer.emoji, 0, px * 0.06);
  ctx.restore();
  return { id: layer.id, cx, cy, w: px * 1.15, h: px * 1.15, rotation: layer.rotation };
}

// ---------- shapes ----------

function drawShapeLayer(
  ctx: CanvasRenderingContext2D,
  layer: ShapeLayer,
  outW: number,
  outH: number
): LayerBox {
  const w = Math.max(8, layer.wPct * outW);
  const h = Math.max(4, layer.hPct * outH);
  const cx = layer.x * outW;
  const cy = layer.y * outH;
  const strokePx = Math.max(2, layer.strokePct * outW);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.globalAlpha = clamp(layer.opacity, 0, 1);
  ctx.strokeStyle = layer.color;
  ctx.fillStyle = layer.color;
  ctx.lineWidth = strokePx;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = strokePx * 1.5;

  switch (layer.shape) {
    case "circle": {
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      if (layer.fillOpacity > 0) {
        ctx.save();
        ctx.globalAlpha = clamp(layer.opacity, 0, 1) * clamp(layer.fillOpacity, 0, 1);
        ctx.fill();
        ctx.restore();
      }
      ctx.stroke();
      break;
    }
    case "rect": {
      const r = Math.min(w, h) * 0.08;
      roundRect(ctx, -w / 2, -h / 2, w, h, r);
      if (layer.fillOpacity > 0) {
        ctx.save();
        ctx.globalAlpha = clamp(layer.opacity, 0, 1) * clamp(layer.fillOpacity, 0, 1);
        ctx.fill();
        ctx.restore();
      }
      ctx.stroke();
      break;
    }
    case "line": {
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.lineTo(w / 2, 0);
      ctx.lineWidth = Math.max(strokePx, h);
      ctx.stroke();
      break;
    }
    case "arrow": {
      // Solid arrow: shaft + filled head, scaled to the box.
      const headL = Math.min(w * 0.42, h * 1.6);
      const shaftH = h * 0.45;
      ctx.beginPath();
      ctx.moveTo(-w / 2, -shaftH / 2);
      ctx.lineTo(w / 2 - headL, -shaftH / 2);
      ctx.lineTo(w / 2 - headL, -h / 2);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(w / 2 - headL, h / 2);
      ctx.lineTo(w / 2 - headL, shaftH / 2);
      ctx.lineTo(-w / 2, shaftH / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
  return {
    id: layer.id,
    cx,
    cy,
    w: w + strokePx * 2,
    h: (layer.shape === "line" ? Math.max(strokePx, h) : h) + strokePx * 2,
    rotation: layer.rotation,
  };
}

// ---------- helpers ----------

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Render the doc at full output resolution and return a PNG data URL. */
export function exportThumbPng(
  doc: ThumbDoc,
  outW: number,
  outH: number,
  backgroundImage: HTMLImageElement | undefined,
  options: { transparentBackground?: boolean } = {},
): string {
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  renderThumbDoc(ctx, doc, outW, outH, { backgroundImage, ...options });
  return canvas.toDataURL("image/png");
}
