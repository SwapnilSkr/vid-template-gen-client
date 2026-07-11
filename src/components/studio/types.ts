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
  onConfirm: () => void | Promise<void>;
  /** Called when the modal is dismissed without confirming. */
  onCancel?: () => void;
}

export type StudioRun = (
  action: () => Promise<Reel>,
  opts?: { requireFfmpeg?: boolean }
) => Promise<void>;
