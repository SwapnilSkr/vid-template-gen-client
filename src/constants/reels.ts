export const REEL_GENRES = [
  "aita_family",
  "relationship_drama",
  "wedding_drama",
  "petty_revenge",
  "pro_revenge",
  "malicious_compliance",
  "workplace_justice",
  "customer_service",
  "confession",
  "tifu",
] as const;

// Mirrors HORROR_TARGETS in server/src/services/trend-scout.service.ts
export const HORROR_GENRES = [
  "2d_comic_horror",
  "urban_legend",
  "creepypasta",
  "paranormal",
  "analog_horror",
] as const;

export const NICHES = [
  { value: "reddit", label: "Reddit Stories" },
  { value: "horror", label: "AI Horror" },
] as const;

export const NICHE_GENRES: Record<string, readonly string[]> = {
  reddit: REEL_GENRES,
  horror: HORROR_GENRES,
};

// Motion policy for image/horror niches. AI modes generate real image-to-video
// clips (slower + paid); parallax is a free FFmpeg "living still".
export const MOTION_MODES = [
  { value: "parallax", label: "Living Still (parallax)", hint: "Free. Breathing, drifting motion on every scene." },
  { value: "ai_hybrid", label: "AI Hybrid", hint: "Real AI motion on hook + climax, parallax elsewhere. ~2 video jobs, slower." },
  { value: "ai_full", label: "Full AI Motion", hint: "Every scene animated with AI video. Best motion, costs more, slowest." },
  { value: "ken_burns", label: "Ken Burns (classic)", hint: "Simple pan/zoom. Fastest, most basic." },
] as const;

export const GENERATION_STAGES = ["Intake", "Scripting", "Voiceover", "Render", "Review"] as const;

export const STAGE_PROGRESS_THRESHOLDS = [5, 20, 45, 75, 100] as const;
