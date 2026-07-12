import type { ReactNode } from "react";
import {
  Captions,
  Image as ImageIcon,
  Layers,
  Mic2,
  Palette,
  Settings2,
  SlidersHorizontal,
  Youtube,
} from "lucide-react";
import type { CaptionStyle, Reel } from "@/api/reels";
import type { InspectorTab } from "@/components/studio/types";

export const CAPTION_DEFAULTS: Required<Omit<CaptionStyle, "animation">> & {
  animation: "none" | "pop";
} = {
  fontName: "Arial",
  fontSize: 135,
  primaryColor: "#FFFFFF",
  activeColor: "#FFD700",
  outlineColor: "#000000",
  outlineWidth: 4,
  shadow: 2,
  alignment: 2,
  marginV: 320,
  marginL: 90,
  marginR: 90,
  chunkSize: 4,
  bold: true,
  uppercase: true,
  animation: "none",
  karaoke: false,
};

export const CAPTION_STYLE_DEFAULTS = {
  ...CAPTION_DEFAULTS,
  animation: CAPTION_DEFAULTS.animation,
} as const;

export const VOICE_POST_PROFILES: {
  value: NonNullable<Reel["audioPost"]>["voiceProfile"];
  label: string;
}[] = [
  { value: "horror", label: "Dark narrator - low, compressed, room echo" },
  { value: "whisper", label: "Whisper room - close, breathy, uneasy" },
  { value: "phone", label: "Phone recording - narrow, distorted call" },
  { value: "tape", label: "Analog tape - degraded recorder, slight wobble" },
  { value: "distant", label: "Distant basement - muffled, far-room echo" },
  { value: "none", label: "Clean - no voice FX" },
];

export const INSPECTOR_TABS: {
  id: InspectorTab;
  label: string;
  icon: ReactNode;
}[] = [
  { id: "source", label: "Source", icon: <Layers size={15} /> },
  { id: "voice", label: "Voice", icon: <Mic2 size={15} /> },
  { id: "look", label: "Look", icon: <Palette size={15} /> },
  { id: "effects", label: "Effects", icon: <SlidersHorizontal size={15} /> },
  { id: "outro", label: "Outro", icon: <Youtube size={15} /> },
  { id: "thumbnail", label: "Thumb", icon: <ImageIcon size={15} /> },
  { id: "captions", label: "Captions", icon: <Captions size={15} /> },
  { id: "export", label: "Render", icon: <Settings2 size={15} /> },
];
