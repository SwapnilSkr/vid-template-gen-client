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

export const GENERATION_STAGES = ["Intake", "Scripting", "Voiceover", "Render", "Review"] as const;

export const STAGE_PROGRESS_THRESHOLDS = [5, 20, 45, 75, 100] as const;
