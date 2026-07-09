import type { BackgroundState, ShapeKind, TextLayer } from "./doc";

// ============================================
// One-click style presets. Presets only patch numeric/color fields on the
// layer/background, so every look stays fully hand-tweakable afterwards.
// ============================================

export interface TextStylePreset {
  id: string;
  label: string;
  hint: string;
  /** Swatch colors for the preset chip. */
  swatch: [string, string];
  patch: Partial<TextLayer>;
}

const FX_OFF: Partial<TextLayer> = {
  strokePct: 0,
  shadowBlurPct: 0,
  shadowXPct: 0,
  shadowYPct: 0,
  glowStrength: 0,
  extrudeDepthPct: 0,
  glitch: false,
  bgOpacity: 0,
  letterSpacing: 0,
};

export const TEXT_STYLE_PRESETS: TextStylePreset[] = [
  {
    id: "classic",
    label: "Impact",
    hint: "White fill, fat black stroke, hard shadow — the YT default",
    swatch: ["#ffffff", "#000000"],
    patch: {
      ...FX_OFF,
      fill: { type: "solid", color: "#ffffff" },
      strokeColor: "#000000",
      strokePct: 0.11,
      shadowColor: "#000000",
      shadowBlurPct: 0.1,
      shadowYPct: 0.06,
      uppercase: true,
    },
  },
  {
    id: "beast",
    label: "Beast",
    hint: "Yellow-orange gradient, black stroke, punched shadow",
    swatch: ["#ffe259", "#ffa751"],
    patch: {
      ...FX_OFF,
      fill: { type: "gradient", color: "#ffe259", from: "#ffe259", to: "#ffa751" },
      strokeColor: "#111111",
      strokePct: 0.12,
      shadowColor: "#000000",
      shadowBlurPct: 0.02,
      shadowXPct: 0.035,
      shadowYPct: 0.055,
      uppercase: true,
    },
  },
  {
    id: "fire",
    label: "Fire",
    hint: "Red-gold gradient with a hot orange glow",
    swatch: ["#ff512f", "#f9d423"],
    patch: {
      ...FX_OFF,
      fill: { type: "gradient", color: "#ff512f", from: "#f9d423", to: "#ff512f" },
      strokeColor: "#3d0a00",
      strokePct: 0.09,
      glowColor: "#ff7a00",
      glowStrength: 0.85,
      shadowColor: "#000000",
      shadowBlurPct: 0.12,
      shadowYPct: 0.05,
      uppercase: true,
    },
  },
  {
    id: "horror",
    label: "Horror",
    hint: "Blood red, black halo — made for scary stories",
    swatch: ["#d90429", "#1a0000"],
    patch: {
      ...FX_OFF,
      fill: { type: "gradient", color: "#ff0f2f", from: "#ff2b2b", to: "#8a0303" },
      strokeColor: "#000000",
      strokePct: 0.1,
      glowColor: "#3f0000",
      glowStrength: 1,
      shadowColor: "#000000",
      shadowBlurPct: 0.2,
      shadowYPct: 0.04,
      uppercase: true,
    },
  },
  {
    id: "neon",
    label: "Neon",
    hint: "White core with an electric magenta glow",
    swatch: ["#ffffff", "#ff2bd6"],
    patch: {
      ...FX_OFF,
      fill: { type: "solid", color: "#ffffff" },
      strokeColor: "#ff2bd6",
      strokePct: 0.03,
      glowColor: "#ff2bd6",
      glowStrength: 1,
      shadowColor: "#000000",
      shadowBlurPct: 0.14,
      shadowYPct: 0.04,
      uppercase: true,
    },
  },
  {
    id: "ice",
    label: "Ice",
    hint: "Frosted white-cyan gradient with a cold glow",
    swatch: ["#e0f7ff", "#4fc3f7"],
    patch: {
      ...FX_OFF,
      fill: { type: "gradient", color: "#e0f7ff", from: "#ffffff", to: "#4fc3f7" },
      strokeColor: "#062c3d",
      strokePct: 0.09,
      glowColor: "#4fc3f7",
      glowStrength: 0.7,
      uppercase: true,
    },
  },
  {
    id: "toxic",
    label: "Toxic",
    hint: "Radioactive green — gaming energy",
    swatch: ["#c6ff00", "#2e7d32"],
    patch: {
      ...FX_OFF,
      fill: { type: "gradient", color: "#c6ff00", from: "#eaff70", to: "#7ceb00" },
      strokeColor: "#0b2902",
      strokePct: 0.11,
      glowColor: "#7ceb00",
      glowStrength: 0.8,
      uppercase: true,
    },
  },
  {
    id: "gold",
    label: "Gold",
    hint: "Luxe metallic gradient with deep shadow",
    swatch: ["#f7d774", "#a86f00"],
    patch: {
      ...FX_OFF,
      fill: { type: "gradient", color: "#f7d774", from: "#fff3b0", to: "#c98a00" },
      strokeColor: "#2b1a00",
      strokePct: 0.09,
      shadowColor: "#000000",
      shadowBlurPct: 0.08,
      shadowYPct: 0.06,
      uppercase: true,
    },
  },
  {
    id: "comic",
    label: "Comic 3D",
    hint: "Solid extruded block letters, cartoon punch",
    swatch: ["#ffffff", "#2962ff"],
    patch: {
      ...FX_OFF,
      fill: { type: "solid", color: "#ffffff" },
      strokeColor: "#000000",
      strokePct: 0.08,
      extrudeDepthPct: 0.12,
      extrudeColor: "#2962ff",
      shadowColor: "#000000",
      shadowBlurPct: 0.06,
      shadowYPct: 0.08,
      uppercase: true,
    },
  },
  {
    id: "glitch",
    label: "Glitch",
    hint: "RGB-split chromatic aberration",
    swatch: ["#ff004c", "#00e5ff"],
    patch: {
      ...FX_OFF,
      fill: { type: "solid", color: "#ffffff" },
      strokeColor: "#000000",
      strokePct: 0.05,
      glitch: true,
      shadowColor: "#000000",
      shadowBlurPct: 0.1,
      shadowYPct: 0.04,
      uppercase: true,
    },
  },
  {
    id: "pill",
    label: "Pill",
    hint: "Caption bar on rounded dark backing",
    swatch: ["#ffffff", "#111111"],
    patch: {
      ...FX_OFF,
      fill: { type: "solid", color: "#ffffff" },
      shadowColor: "#000000",
      shadowBlurPct: 0.06,
      shadowYPct: 0.03,
      bgColor: "#0b0b0f",
      bgOpacity: 0.85,
      bgRadiusPct: 0.5,
      bgPadPct: 0.3,
      uppercase: false,
    },
  },
  {
    id: "banner",
    label: "Banner",
    hint: "Bold red news-strip backing",
    swatch: ["#ffffff", "#d90429"],
    patch: {
      ...FX_OFF,
      fill: { type: "solid", color: "#ffffff" },
      bgColor: "#d90429",
      bgOpacity: 1,
      bgRadiusPct: 0.08,
      bgPadPct: 0.32,
      letterSpacing: 0.04,
      uppercase: true,
    },
  },
];

// ============================================
// Background filter presets — patch the numeric grade fields.
// ============================================

export interface FilterPreset {
  id: string;
  label: string;
  patch: Partial<BackgroundState>;
}

const GRADE_RESET: Partial<BackgroundState> = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  hue: 0,
  grayscale: 0,
  sepia: 0,
  temperature: 0,
  blur: 0,
};

export const FILTER_PRESETS: FilterPreset[] = [
  { id: "none", label: "Original", patch: { ...GRADE_RESET } },
  { id: "vivid", label: "Vivid", patch: { ...GRADE_RESET, saturation: 1.45, contrast: 1.12, brightness: 1.04 } },
  { id: "punch", label: "Punch", patch: { ...GRADE_RESET, saturation: 1.3, contrast: 1.22 } },
  { id: "cinematic", label: "Cinematic", patch: { ...GRADE_RESET, saturation: 0.85, contrast: 1.18, brightness: 0.94, temperature: -0.15 } },
  { id: "warm", label: "Golden", patch: { ...GRADE_RESET, sepia: 0.18, saturation: 1.2, brightness: 1.03, temperature: 0.45 } },
  { id: "cool", label: "Arctic", patch: { ...GRADE_RESET, saturation: 0.95, temperature: -0.5, contrast: 1.06 } },
  { id: "noir", label: "Noir", patch: { ...GRADE_RESET, grayscale: 1, contrast: 1.3, brightness: 0.96 } },
  { id: "horror", label: "Horror", patch: { ...GRADE_RESET, saturation: 0.7, contrast: 1.28, brightness: 0.82, temperature: -0.3 } },
  { id: "dream", label: "Dream", patch: { ...GRADE_RESET, brightness: 1.1, saturation: 1.15, blur: 1.5, contrast: 0.95 } },
  { id: "vhs", label: "VHS", patch: { ...GRADE_RESET, saturation: 1.25, contrast: 1.08, sepia: 0.12, temperature: 0.15 } },
];

// ============================================
// Gradient overlays drawn over the graded background.
// ============================================

export interface OverlayPreset {
  id: string;
  label: string;
  /** [stopColor, stopColor] top→bottom, or radial for "edges". */
  kind: "none" | "bottom" | "top" | "edges" | "full" | "diagonal";
  colors: [string, string];
}

export const OVERLAY_PRESETS: OverlayPreset[] = [
  { id: "none", label: "None", kind: "none", colors: ["#000000", "#000000"] },
  { id: "dark-bottom", label: "Dark floor", kind: "bottom", colors: ["rgba(0,0,0,0)", "rgba(0,0,0,0.92)"] },
  { id: "dark-top", label: "Dark sky", kind: "top", colors: ["rgba(0,0,0,0.92)", "rgba(0,0,0,0)"] },
  { id: "dark-edges", label: "Tunnel", kind: "edges", colors: ["rgba(0,0,0,0)", "rgba(0,0,0,0.95)"] },
  { id: "red-wash", label: "Red alert", kind: "full", colors: ["rgba(217,4,41,0.45)", "rgba(122,0,18,0.55)"] },
  { id: "blue-wash", label: "Deep blue", kind: "full", colors: ["rgba(21,74,161,0.4)", "rgba(8,20,60,0.6)"] },
  { id: "purple-haze", label: "Purple haze", kind: "diagonal", colors: ["rgba(124,58,237,0.45)", "rgba(30,10,80,0.55)"] },
  { id: "teal-orange", label: "Teal & orange", kind: "diagonal", colors: ["rgba(0,150,170,0.35)", "rgba(255,120,30,0.35)"] },
];

// ============================================
// Sticker + shape palettes.
// ============================================

export const STICKER_EMOJI: string[] = [
  "😱", "🤯", "😨", "😂", "🥶", "💀", "👻", "🩸", "🔥", "⚡",
  "💰", "💯", "👀", "🎯", "⚠️", "❗", "❓", "🔴", "✅", "❌",
  "🏆", "💣", "🕐", "📈", "📉", "🤫", "🙏", "😈", "🫣", "🚨",
];

export const SHAPE_OPTIONS: { id: ShapeKind; label: string }[] = [
  { id: "arrow", label: "Arrow" },
  { id: "circle", label: "Circle" },
  { id: "rect", label: "Box" },
  { id: "line", label: "Line" },
];

/** Fonts always available without server files — broad, bold system stacks. */
export const SYSTEM_FONTS: { family: string; label: string }[] = [
  { family: "Impact, 'Arial Black', sans-serif", label: "Impact (system)" },
  { family: "'Arial Black', Arial, sans-serif", label: "Arial Black (system)" },
  { family: "Futura, 'Trebuchet MS', sans-serif", label: "Futura (system)" },
  { family: "Georgia, 'Times New Roman', serif", label: "Georgia (system)" },
];
