// ============================================
// Thumbnail editor document model.
//
// The editor is a layered, client-rendered canvas: one background (video
// frame / scene still / saved thumbnail) graded with filters + overlays, and
// a stack of text / sticker / shape layers on top. The whole doc is plain
// JSON — it round-trips through sessionStorage and the server draft's
// editorState so the layer stack survives navigation and restaging.
//
// Coordinates are resolution-independent: positions are fractions of the
// output canvas (x/y = layer center), sizes are fractions of the output
// WIDTH, so switching aspect ratio keeps compositions proportional.
// ============================================

export type ThumbAspect = "16:9" | "9:16" | "1:1";

export function outputSize(aspect: ThumbAspect): { width: number; height: number } {
  if (aspect === "9:16") return { width: 1080, height: 1920 };
  if (aspect === "1:1") return { width: 1080, height: 1080 };
  return { width: 1280, height: 720 };
}

export interface TextFill {
  type: "solid" | "gradient";
  color: string;
  /** Gradient stops, top → bottom of the text block. */
  from?: string;
  to?: string;
}

export interface TextLayer {
  id: string;
  type: "text";
  text: string;
  /** Layer center, fraction of canvas. */
  x: number;
  y: number;
  /** Wrap width, fraction of canvas width. */
  widthPct: number;
  rotation: number;
  opacity: number;
  hidden?: boolean;

  fontFamily: string;
  /** Font size as a fraction of output width (0.075 ≈ 96px @ 1280). */
  sizePct: number;
  fill: TextFill;
  strokeColor: string;
  /** Stroke width as a fraction of font size. */
  strokePct: number;
  align: "left" | "center" | "right";
  lineHeight: number;
  /** Extra tracking in em. */
  letterSpacing: number;
  uppercase: boolean;

  shadowColor: string;
  /** Shadow blur / offset as fractions of font size. 0 all around = off. */
  shadowBlurPct: number;
  shadowXPct: number;
  shadowYPct: number;

  /** Outer glow (0 = off). */
  glowColor: string;
  glowStrength: number;

  /** Solid 3D extrusion depth as a fraction of font size (comic look). */
  extrudeDepthPct: number;
  extrudeColor: string;

  /** RGB-split glitch copies. */
  glitch: boolean;

  /** Per-line backing pill/banner behind the text. */
  bgColor: string;
  bgOpacity: number;
  /** Corner radius as fraction of line height (0.5 = full pill). */
  bgRadiusPct: number;
  bgPadPct: number;

  /** Last applied style preset (UI highlight only). */
  styleId?: string;
}

export interface StickerLayer {
  id: string;
  type: "sticker";
  emoji: string;
  x: number;
  y: number;
  /** Glyph size as a fraction of output width. */
  sizePct: number;
  rotation: number;
  opacity: number;
  hidden?: boolean;
  shadow: boolean;
}

export type ShapeKind = "arrow" | "circle" | "rect" | "line";

export interface ShapeLayer {
  id: string;
  type: "shape";
  shape: ShapeKind;
  x: number;
  y: number;
  /** Bounding box as fractions of output width/height. */
  wPct: number;
  hPct: number;
  rotation: number;
  opacity: number;
  hidden?: boolean;
  color: string;
  /** Stroke width as a fraction of output width. */
  strokePct: number;
  fillOpacity: number;
}

export type ThumbLayer = TextLayer | StickerLayer | ShapeLayer;

export interface BackgroundState {
  sourceType: "frame" | "scene" | "saved";
  atSeconds: number;
  sceneIndex?: number;

  zoom: number;
  /** Pan of the overflowing image, -1..1 of the available overflow. */
  offsetX: number;
  offsetY: number;
  flipH: boolean;

  /** Numeric grade — presets just patch these, so everything stays tweakable. */
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  grayscale: number;
  sepia: number;
  blur: number;
  /** Warm/cool color cast, -1..1. */
  temperature: number;
  vignette: number;
  grain: number;

  overlayId: string;
  overlayOpacity: number;

  /** Last applied filter preset (UI highlight only). */
  filterId?: string;
}

export interface ThumbDoc {
  version: 2;
  aspectRatio: ThumbAspect;
  background: BackgroundState;
  layers: ThumbLayer[];
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const DEFAULT_BACKGROUND: BackgroundState = {
  sourceType: "scene",
  atSeconds: 1,
  sceneIndex: undefined,
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  flipH: false,
  brightness: 1,
  contrast: 1,
  saturation: 1,
  hue: 0,
  grayscale: 0,
  sepia: 0,
  blur: 0,
  temperature: 0,
  vignette: 0.25,
  grain: 0,
  overlayId: "none",
  overlayOpacity: 0.6,
  filterId: "none",
};

export function defaultTextLayer(patch: Partial<TextLayer> = {}): TextLayer {
  return {
    id: uid(),
    type: "text",
    text: "YOUR HEADLINE",
    x: 0.5,
    y: 0.4,
    widthPct: 0.84,
    rotation: 0,
    opacity: 1,
    fontFamily: "Anton",
    sizePct: 0.085,
    fill: { type: "solid", color: "#ffffff" },
    strokeColor: "#000000",
    strokePct: 0.1,
    align: "center",
    lineHeight: 1.05,
    letterSpacing: 0,
    uppercase: true,
    shadowColor: "#000000",
    shadowBlurPct: 0.12,
    shadowXPct: 0,
    shadowYPct: 0.05,
    glowColor: "#ffffff",
    glowStrength: 0,
    extrudeDepthPct: 0,
    extrudeColor: "#000000",
    glitch: false,
    bgColor: "#000000",
    bgOpacity: 0,
    bgRadiusPct: 0.3,
    bgPadPct: 0.25,
    styleId: "classic",
    ...patch,
  };
}

export function defaultStickerLayer(emoji: string): StickerLayer {
  return {
    id: uid(),
    type: "sticker",
    emoji,
    x: 0.78,
    y: 0.68,
    sizePct: 0.14,
    rotation: 0,
    opacity: 1,
    shadow: true,
  };
}

export function defaultShapeLayer(shape: ShapeKind): ShapeLayer {
  return {
    id: uid(),
    type: "shape",
    shape,
    x: 0.5,
    y: 0.6,
    wPct: shape === "circle" ? 0.28 : 0.3,
    hPct: shape === "line" ? 0.012 : shape === "arrow" ? 0.12 : 0.24,
    rotation: 0,
    opacity: 1,
    color: "#ff2d2d",
    strokePct: 0.012,
    fillOpacity: shape === "rect" ? 0.25 : 0,
  };
}

export function defaultDoc(aspect: ThumbAspect, headline: string): ThumbDoc {
  return {
    version: 2,
    aspectRatio: aspect,
    background: { ...DEFAULT_BACKGROUND },
    layers: headline.trim() ? [defaultTextLayer({ text: headline.trim() })] : [defaultTextLayer()],
  };
}

/**
 * A bounded opening-title layout for vertical Reddit Shorts. The first frame
 * lives below the Reddit title-card area and inside platform-safe edges.
 */
export function defaultRedditShortsCoverDoc(headline: string): ThumbDoc {
  const compact = headline.replace(/\s+/g, " ").trim();
  const coverHeadline = compact.length <= 60
    ? compact
    : `${compact.slice(0, 57).replace(/\s+\S*$/, "").trim()}…`;
  return {
    version: 2,
    aspectRatio: "9:16",
    background: { ...DEFAULT_BACKGROUND, sourceType: "frame", atSeconds: 0, vignette: 0 },
    layers: [defaultTextLayer({
      text: coverHeadline || "YOUR HEADLINE",
      x: 0.5,
      y: 0.66,
      widthPct: 0.82,
      sizePct: coverHeadline.length > 45 ? 0.068 : 0.078,
      bgColor: "#000000",
      bgOpacity: 0.64,
      bgRadiusPct: 0.28,
      bgPadPct: 0.28,
      shadowYPct: 0.06,
    })],
  };
}

/** Best-effort revive of a doc from opaque JSON (session cache or a server
 *  draft's editorState). Returns undefined for anything unrecognizable. */
export function reviveDoc(raw: unknown): ThumbDoc | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const candidate = raw as Partial<ThumbDoc>;
  if (candidate.version !== 2 || !Array.isArray(candidate.layers) || !candidate.background) {
    return undefined;
  }
  const aspect: ThumbAspect =
    candidate.aspectRatio === "9:16" || candidate.aspectRatio === "1:1" ? candidate.aspectRatio : "16:9";
  const layers = candidate.layers.filter(
    (layer): layer is ThumbLayer =>
      Boolean(layer) &&
      typeof (layer as ThumbLayer).id === "string" &&
      ["text", "sticker", "shape"].includes((layer as ThumbLayer).type)
  );
  return {
    version: 2,
    aspectRatio: aspect,
    background: { ...DEFAULT_BACKGROUND, ...candidate.background },
    layers: layers.map((layer) =>
      layer.type === "text"
        ? { ...defaultTextLayer(), ...layer }
        : layer.type === "sticker"
          ? { ...defaultStickerLayer("🔥"), ...layer }
          : { ...defaultShapeLayer("arrow"), ...layer }
    ),
  };
}

/** Convert a legacy drawtext-era draft input into a v2 doc so old staged
 *  drafts still open with their text/position/colors intact. */
export function docFromLegacyDraftInput(
  input: Record<string, unknown>,
  aspect: ThumbAspect
): ThumbDoc | undefined {
  if (typeof input.text !== "string" || !input.text.trim()) return undefined;
  const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  const str = (v: unknown, fallback: string) => (typeof v === "string" && v ? v : fallback);
  const { width } = outputSize(aspect);
  const doc = defaultDoc(aspect, input.text.trim());
  const layer = doc.layers[0] as TextLayer;
  layer.x = num(input.xPct, 0.5);
  // Legacy y was the top of the band; nudge toward center-anchor.
  layer.y = Math.min(0.9, num(input.yPct, 0.38) + 0.08);
  layer.widthPct = num(input.widthPct, 0.84);
  layer.sizePct = num(input.fontSize, 96) / width;
  layer.fontFamily = str(input.fontFamily, layer.fontFamily);
  layer.fill = { type: "solid", color: str(input.color, "#ffffff") };
  layer.strokeColor = str(input.outlineColor, "#000000");
  layer.align = input.align === "left" || input.align === "right" ? input.align : "center";
  layer.lineHeight = num(input.lineHeight, 1.05);
  layer.uppercase = input.uppercase !== false;
  doc.background.sourceType = input.sourceType === "frame" ? "frame" : "scene";
  doc.background.atSeconds = num(input.atSeconds, 1);
  if (typeof input.sceneIndex === "number") doc.background.sceneIndex = input.sceneIndex;
  return doc;
}
