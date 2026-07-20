import type { Reel } from "@/api/reels";

export type InspectorTab =
  | "source"
  | "voice"
  | "look"
  | "effects"
  | "outro"
  | "thumbnail"
  | "captions"
  | "export";

export interface ConfirmAction {
  title: string;
  body: string;
  details?: string[];
  confirmLabel: string;
  variant?: "default" | "destructive";
  /** Free / credits / compute — shown as a chip on the confirm modal. */
  costTone?: "free" | "paid" | "warm";
  /** A failed Studio action keeps this dialog open and shows its error here. */
  /** Optional decision shown inside the confirmation itself before a paid
   * generate action. This keeps required editorial choices at the moment they
   * matter rather than hiding them in a distant inspector panel. */
  seriesStructure?: {
    currentParts: number;
    recommendedParts: number;
    wordCount: number;
    estimatedDurationSeconds: number;
    reason: string;
    hasWeakBreaks: boolean;
  };
  onConfirm: (seriesChoice?: "manual" | "recommended") => void | Promise<void | StudioActionResult>;
  /** Called when the modal is dismissed without confirming. */
  onCancel?: () => void;
}

export interface StudioActionResult {
  ok: boolean;
  error?: string;
}

/** A concrete account selected in the final publish dialog. Studio uses this
 * to follow the asynchronous result after that dialog closes. */
export interface StudioPublishTarget {
  platform: "youtube" | "instagram" | "facebook" | "threads";
  channelId: string;
  channelLabel: string;
}

export type StudioRun = (
  action: () => Promise<Reel>,
  opts?: { requireFfmpeg?: boolean }
) => Promise<StudioActionResult>;
