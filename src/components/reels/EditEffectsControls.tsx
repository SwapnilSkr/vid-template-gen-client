import { CloudRain, Film, Focus, Scan, Sparkles, Tv, Waves, Zap } from "lucide-react";
import type { EditEffects } from "@/api/reels";
import { cn } from "@/lib/utils";

/** Co-creatable cinematic edit FX (rain / grade / analog texture / letterbox).
 *  A controlled block used identically on the create form and in the Studio.
 *  All effects are render-only, so applying them is a free re-render. */
export function EditEffectsControls({
  value,
  onChange,
  disabled = false,
}: {
  value?: EditEffects;
  onChange: (next: EditEffects) => void;
  disabled?: boolean;
}) {
  const fx = value ?? {};
  const patch = (next: Partial<EditEffects>) => onChange({ ...fx, ...next });

  return (
    <div className="grid gap-2.5">
      <Toggle
        icon={<CloudRain size={15} />}
        label="Rain"
        hint="Animated rain streaks over every scene."
        checked={Boolean(fx.rain)}
        disabled={disabled}
        onChange={(on) => patch({ rain: on })}
      >
        {fx.rain ? (
          <Slider
            label="Intensity"
            min={0}
            max={1}
            step={0.05}
            value={fx.rainIntensity ?? 0.5}
            disabled={disabled}
            onChange={(v) => patch({ rainIntensity: v })}
          />
        ) : null}
      </Toggle>

      <Slider
        icon={<Focus size={15} />}
        label="Cold desaturation"
        hint="0 = off"
        min={0}
        max={1}
        step={0.05}
        value={fx.desaturate ?? 0}
        disabled={disabled}
        onChange={(v) => patch({ desaturate: v })}
      />

      <Slider
        icon={<Zap size={15} />}
        label="Light flicker"
        hint="0 = off"
        min={0}
        max={1}
        step={0.05}
        value={fx.flicker ?? 0}
        disabled={disabled}
        onChange={(v) => patch({ flicker: v })}
      />

      <Slider
        icon={<Waves size={15} />}
        label="Chromatic bleed"
        hint="0 = off"
        min={0}
        max={1}
        step={0.05}
        value={fx.chromatic ?? 0}
        disabled={disabled}
        onChange={(v) => patch({ chromatic: v })}
      />

      <Slider
        icon={<Tv size={15} />}
        label="Analog scanlines"
        hint="0 = off"
        min={0}
        max={1}
        step={0.05}
        value={fx.scanlines ?? 0}
        disabled={disabled}
        onChange={(v) => patch({ scanlines: v })}
      />

      <Slider
        icon={<Film size={15} />}
        label="Film grain"
        hint="0 = off"
        min={0}
        max={1.5}
        step={0.1}
        value={fx.grain ?? 0}
        disabled={disabled}
        onChange={(v) => patch({ grain: v })}
      />

      <Slider
        icon={<Sparkles size={15} />}
        label="Vignette"
        hint="0 = off"
        min={0}
        max={1}
        step={0.05}
        value={fx.vignette ?? 0}
        disabled={disabled}
        onChange={(v) => patch({ vignette: v })}
      />

      <Toggle
        icon={<Scan size={15} />}
        label="Letterbox"
        hint="Cinematic black bars, top & bottom."
        checked={Boolean(fx.letterbox)}
        disabled={disabled}
        onChange={(on) => patch({ letterbox: on })}
      />
    </div>
  );
}

function Toggle({
  icon,
  label,
  hint,
  checked,
  disabled,
  onChange,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5 rounded-md border border-border bg-background/60 px-2.5 py-2">
      <label className={cn("flex items-start gap-2 text-xs text-foreground", disabled && "opacity-60")}>
        <input
          type="checkbox"
          className="mt-0.5"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="inline-flex items-center gap-1.5 font-medium">
          {icon}
          {label}
        </span>
        <span className="text-muted-foreground">— {hint}</span>
      </label>
      {children}
    </div>
  );
}

function Slider({
  icon,
  label,
  hint,
  min,
  max,
  step,
  value,
  disabled,
  onChange,
}: {
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  const off = value <= 0;
  return (
    <div className={cn("grid gap-1", icon && "rounded-md border border-border bg-background/60 px-2.5 py-2")}>
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          {icon}
          {label}
          {hint ? <span className="font-normal text-muted-foreground">{hint}</span> : null}
        </span>
        <span className="tabular-nums font-medium text-muted-foreground">{off ? "off" : value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-primary"
      />
    </div>
  );
}
