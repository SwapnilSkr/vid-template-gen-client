import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Shapes,
  Smile,
  Trash2,
  Type,
} from "lucide-react";
import type { FontOption } from "@/api/reels";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  BackgroundState,
  ShapeLayer,
  StickerLayer,
  TextLayer,
  ThumbLayer,
} from "./doc";
import {
  FILTER_PRESETS,
  OVERLAY_PRESETS,
  SYSTEM_FONTS,
  TEXT_STYLE_PRESETS,
} from "./presets";

// ============================================
// Inspector panels — context-sensitive controls for the selected layer or the
// background. All edits flow through onPatch; `commit` marks an undo step.
// ============================================

export interface PatchFn<T> {
  (patch: Partial<T>, commit?: boolean): void;
}

// ---------- shared rows ----------

export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  disabled,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  disabled?: boolean;
  onChange: (v: number) => void;
  onCommit: () => void;
}) {
  return (
    <label className="grid grid-cols-[86px_1fr_44px] items-center gap-2 text-xs text-muted-foreground">
      <span className="truncate">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="w-full accent-(--color-primary)"
      />
      <span className="text-right tabular-nums text-[11px] text-foreground/80">
        {format ? format(value) : value.toFixed(2)}
      </span>
    </label>
  );
}

export function ColorRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="grid grid-cols-[86px_1fr] items-center gap-2 text-xs text-muted-foreground">
      <span className="truncate">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          className="h-7 w-10 shrink-0 cursor-pointer rounded border border-border bg-background"
          disabled={disabled}
          value={toHexColor(value)}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="font-mono text-[11px] text-foreground/70">{toHexColor(value)}</span>
      </span>
    </label>
  );
}

function toHexColor(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff";
}

// ---------- text inspector ----------

export function TextInspector({
  layer,
  fonts,
  disabled,
  onPatch,
}: {
  layer: TextLayer;
  fonts: FontOption[];
  disabled: boolean;
  onPatch: PatchFn<TextLayer>;
}) {
  const commitPatch = (patch: Partial<TextLayer>) => onPatch(patch, true);
  return (
    <div className="grid gap-3">
      <Textarea
        rows={3}
        maxLength={200}
        disabled={disabled}
        value={layer.text}
        placeholder="Headline text — or double-click it on the canvas"
        onChange={(e) => onPatch({ text: e.target.value })}
        onBlur={() => onPatch({}, true)}
      />

      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Style presets</span>
        <div className="grid grid-cols-4 gap-1.5">
          {TEXT_STYLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              title={preset.hint}
              onClick={() => commitPatch({ ...preset.patch, styleId: preset.id })}
              className={cn(
                "grid justify-items-center gap-1 rounded-md border px-1 py-1.5 text-[10px] font-semibold transition-colors",
                layer.styleId === preset.id
                  ? "border-primary bg-primary/12 text-primary"
                  : "border-border bg-secondary text-foreground hover:bg-accent"
              )}
            >
              <span
                className="h-3.5 w-8 rounded-sm border border-black/40"
                style={{
                  background: `linear-gradient(135deg, ${preset.swatch[0]}, ${preset.swatch[1]})`,
                }}
              />
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Label>
          Font
          <Select
            disabled={disabled}
            value={layer.fontFamily}
            onChange={(e) => commitPatch({ fontFamily: e.target.value })}
          >
            {fonts.map((font) => (
              <option key={font.id} value={font.family} style={{ fontFamily: font.family }}>
                {font.label}
              </option>
            ))}
            {SYSTEM_FONTS.map((font) => (
              <option key={font.family} value={font.family} style={{ fontFamily: font.family }}>
                {font.label}
              </option>
            ))}
          </Select>
        </Label>
        <Label>
          Align
          <Select
            disabled={disabled}
            value={layer.align}
            onChange={(e) => commitPatch({ align: e.target.value as TextLayer["align"] })}
          >
            <option value="center">Center</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </Select>
        </Label>
      </div>

      <SliderRow
        label="Size"
        value={layer.sizePct}
        min={0.02}
        max={0.3}
        step={0.002}
        format={(v) => `${Math.round(v * 1000)}`}
        disabled={disabled}
        onChange={(v) => onPatch({ sizePct: v })}
        onCommit={() => onPatch({}, true)}
      />
      <SliderRow
        label="Line height"
        value={layer.lineHeight}
        min={0.8}
        max={1.8}
        step={0.05}
        disabled={disabled}
        onChange={(v) => onPatch({ lineHeight: v })}
        onCommit={() => onPatch({}, true)}
      />
      <SliderRow
        label="Tracking"
        value={layer.letterSpacing}
        min={-0.05}
        max={0.3}
        step={0.005}
        disabled={disabled}
        onChange={(v) => onPatch({ letterSpacing: v })}
        onCommit={() => onPatch({}, true)}
      />
      <SliderRow
        label="Rotation"
        value={layer.rotation}
        min={-45}
        max={45}
        step={0.5}
        format={(v) => `${v.toFixed(0)}°`}
        disabled={disabled}
        onChange={(v) => onPatch({ rotation: v })}
        onCommit={() => onPatch({}, true)}
      />
      <SliderRow
        label="Opacity"
        value={layer.opacity}
        min={0.1}
        max={1}
        step={0.05}
        disabled={disabled}
        onChange={(v) => onPatch({ opacity: v })}
        onCommit={() => onPatch({}, true)}
      />

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={layer.uppercase}
          disabled={disabled}
          onChange={(e) => commitPatch({ uppercase: e.target.checked })}
        />
        ALL CAPS
      </label>

      <div className="grid gap-2 rounded-md border border-border bg-background/40 p-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Fill & stroke
        </span>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={layer.fill.type === "gradient"}
            disabled={disabled}
            onChange={(e) =>
              commitPatch({
                fill: e.target.checked
                  ? {
                      type: "gradient",
                      color: layer.fill.color,
                      from: layer.fill.from ?? layer.fill.color,
                      to: layer.fill.to ?? "#ffa751",
                    }
                  : { type: "solid", color: layer.fill.from ?? layer.fill.color },
              })
            }
          />
          Gradient fill
        </label>
        {layer.fill.type === "gradient" ? (
          <>
            <ColorRow
              label="Top"
              value={layer.fill.from ?? layer.fill.color}
              disabled={disabled}
              onChange={(v) => commitPatch({ fill: { ...layer.fill, from: v } })}
            />
            <ColorRow
              label="Bottom"
              value={layer.fill.to ?? layer.fill.color}
              disabled={disabled}
              onChange={(v) => commitPatch({ fill: { ...layer.fill, to: v } })}
            />
          </>
        ) : (
          <ColorRow
            label="Color"
            value={layer.fill.color}
            disabled={disabled}
            onChange={(v) => commitPatch({ fill: { type: "solid", color: v } })}
          />
        )}
        <ColorRow
          label="Stroke"
          value={layer.strokeColor}
          disabled={disabled}
          onChange={(v) => commitPatch({ strokeColor: v })}
        />
        <SliderRow
          label="Stroke width"
          value={layer.strokePct}
          min={0}
          max={0.25}
          step={0.005}
          disabled={disabled}
          onChange={(v) => onPatch({ strokePct: v })}
          onCommit={() => onPatch({}, true)}
        />
      </div>

      <div className="grid gap-2 rounded-md border border-border bg-background/40 p-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Effects
        </span>
        <SliderRow
          label="Shadow"
          value={layer.shadowBlurPct}
          min={0}
          max={0.4}
          step={0.01}
          disabled={disabled}
          onChange={(v) => onPatch({ shadowBlurPct: v })}
          onCommit={() => onPatch({}, true)}
        />
        <SliderRow
          label="Shadow drop"
          value={layer.shadowYPct}
          min={-0.15}
          max={0.2}
          step={0.005}
          disabled={disabled}
          onChange={(v) => onPatch({ shadowYPct: v })}
          onCommit={() => onPatch({}, true)}
        />
        <ColorRow
          label="Shadow color"
          value={layer.shadowColor}
          disabled={disabled}
          onChange={(v) => commitPatch({ shadowColor: v })}
        />
        <SliderRow
          label="Glow"
          value={layer.glowStrength}
          min={0}
          max={1}
          step={0.05}
          disabled={disabled}
          onChange={(v) => onPatch({ glowStrength: v })}
          onCommit={() => onPatch({}, true)}
        />
        <ColorRow
          label="Glow color"
          value={layer.glowColor}
          disabled={disabled}
          onChange={(v) => commitPatch({ glowColor: v })}
        />
        <SliderRow
          label="3D depth"
          value={layer.extrudeDepthPct}
          min={0}
          max={0.25}
          step={0.01}
          disabled={disabled}
          onChange={(v) => onPatch({ extrudeDepthPct: v })}
          onCommit={() => onPatch({}, true)}
        />
        {layer.extrudeDepthPct > 0 ? (
          <ColorRow
            label="3D color"
            value={layer.extrudeColor}
            disabled={disabled}
            onChange={(v) => commitPatch({ extrudeColor: v })}
          />
        ) : null}
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={layer.glitch}
            disabled={disabled}
            onChange={(e) => commitPatch({ glitch: e.target.checked })}
          />
          RGB glitch split
        </label>
      </div>

      <div className="grid gap-2 rounded-md border border-border bg-background/40 p-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Backing bar
        </span>
        <SliderRow
          label="Opacity"
          value={layer.bgOpacity}
          min={0}
          max={1}
          step={0.05}
          disabled={disabled}
          onChange={(v) => onPatch({ bgOpacity: v })}
          onCommit={() => onPatch({}, true)}
        />
        {layer.bgOpacity > 0 ? (
          <>
            <ColorRow
              label="Color"
              value={layer.bgColor}
              disabled={disabled}
              onChange={(v) => commitPatch({ bgColor: v })}
            />
            <SliderRow
              label="Roundness"
              value={layer.bgRadiusPct}
              min={0}
              max={0.5}
              step={0.02}
              disabled={disabled}
              onChange={(v) => onPatch({ bgRadiusPct: v })}
              onCommit={() => onPatch({}, true)}
            />
            <SliderRow
              label="Padding"
              value={layer.bgPadPct}
              min={0.05}
              max={0.8}
              step={0.02}
              disabled={disabled}
              onChange={(v) => onPatch({ bgPadPct: v })}
              onCommit={() => onPatch({}, true)}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

// ---------- sticker inspector ----------

export function StickerInspector({
  layer,
  disabled,
  onPatch,
}: {
  layer: StickerLayer;
  disabled: boolean;
  onPatch: PatchFn<StickerLayer>;
}) {
  return (
    <div className="grid gap-3">
      <Label>
        Emoji
        <Input
          disabled={disabled}
          value={layer.emoji}
          maxLength={8}
          onChange={(e) => onPatch({ emoji: e.target.value })}
          onBlur={() => onPatch({}, true)}
        />
      </Label>
      <SliderRow
        label="Size"
        value={layer.sizePct}
        min={0.04}
        max={0.6}
        step={0.01}
        disabled={disabled}
        onChange={(v) => onPatch({ sizePct: v })}
        onCommit={() => onPatch({}, true)}
      />
      <SliderRow
        label="Rotation"
        value={layer.rotation}
        min={-180}
        max={180}
        step={1}
        format={(v) => `${v.toFixed(0)}°`}
        disabled={disabled}
        onChange={(v) => onPatch({ rotation: v })}
        onCommit={() => onPatch({}, true)}
      />
      <SliderRow
        label="Opacity"
        value={layer.opacity}
        min={0.1}
        max={1}
        step={0.05}
        disabled={disabled}
        onChange={(v) => onPatch({ opacity: v })}
        onCommit={() => onPatch({}, true)}
      />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={layer.shadow}
          disabled={disabled}
          onChange={(e) => onPatch({ shadow: e.target.checked }, true)}
        />
        Drop shadow
      </label>
    </div>
  );
}

// ---------- shape inspector ----------

export function ShapeInspector({
  layer,
  disabled,
  onPatch,
}: {
  layer: ShapeLayer;
  disabled: boolean;
  onPatch: PatchFn<ShapeLayer>;
}) {
  return (
    <div className="grid gap-3">
      <ColorRow
        label="Color"
        value={layer.color}
        disabled={disabled}
        onChange={(v) => onPatch({ color: v }, true)}
      />
      <SliderRow
        label="Width"
        value={layer.wPct}
        min={0.03}
        max={1.2}
        step={0.01}
        disabled={disabled}
        onChange={(v) => onPatch({ wPct: v })}
        onCommit={() => onPatch({}, true)}
      />
      <SliderRow
        label="Height"
        value={layer.hPct}
        min={0.008}
        max={1.2}
        step={0.01}
        disabled={disabled}
        onChange={(v) => onPatch({ hPct: v })}
        onCommit={() => onPatch({}, true)}
      />
      <SliderRow
        label="Thickness"
        value={layer.strokePct}
        min={0.002}
        max={0.05}
        step={0.001}
        disabled={disabled}
        onChange={(v) => onPatch({ strokePct: v })}
        onCommit={() => onPatch({}, true)}
      />
      {layer.shape === "circle" || layer.shape === "rect" ? (
        <SliderRow
          label="Fill"
          value={layer.fillOpacity}
          min={0}
          max={1}
          step={0.05}
          disabled={disabled}
          onChange={(v) => onPatch({ fillOpacity: v })}
          onCommit={() => onPatch({}, true)}
        />
      ) : null}
      <SliderRow
        label="Rotation"
        value={layer.rotation}
        min={-180}
        max={180}
        step={1}
        format={(v) => `${v.toFixed(0)}°`}
        disabled={disabled}
        onChange={(v) => onPatch({ rotation: v })}
        onCommit={() => onPatch({}, true)}
      />
      <SliderRow
        label="Opacity"
        value={layer.opacity}
        min={0.1}
        max={1}
        step={0.05}
        disabled={disabled}
        onChange={(v) => onPatch({ opacity: v })}
        onCommit={() => onPatch({}, true)}
      />
    </div>
  );
}

// ---------- background inspector ----------

export function BackgroundInspector({
  bg,
  disabled,
  onPatch,
}: {
  bg: BackgroundState;
  disabled: boolean;
  onPatch: PatchFn<BackgroundState>;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Filter presets</span>
        <div className="grid grid-cols-5 gap-1.5">
          {FILTER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              onClick={() => onPatch({ ...preset.patch, filterId: preset.id }, true)}
              className={cn(
                "rounded-md border px-1 py-1.5 text-[10px] font-semibold transition-colors",
                bg.filterId === preset.id
                  ? "border-primary bg-primary/12 text-primary"
                  : "border-border bg-secondary text-foreground hover:bg-accent"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <SliderRow
        label="Brightness"
        value={bg.brightness}
        min={0.4}
        max={1.7}
        step={0.02}
        disabled={disabled}
        onChange={(v) => onPatch({ brightness: v, filterId: undefined })}
        onCommit={() => onPatch({}, true)}
      />
      <SliderRow
        label="Contrast"
        value={bg.contrast}
        min={0.5}
        max={1.8}
        step={0.02}
        disabled={disabled}
        onChange={(v) => onPatch({ contrast: v, filterId: undefined })}
        onCommit={() => onPatch({}, true)}
      />
      <SliderRow
        label="Saturation"
        value={bg.saturation}
        min={0}
        max={2.2}
        step={0.02}
        disabled={disabled}
        onChange={(v) => onPatch({ saturation: v, filterId: undefined })}
        onCommit={() => onPatch({}, true)}
      />
      <SliderRow
        label="Warmth"
        value={bg.temperature}
        min={-1}
        max={1}
        step={0.05}
        disabled={disabled}
        onChange={(v) => onPatch({ temperature: v, filterId: undefined })}
        onCommit={() => onPatch({}, true)}
      />
      <SliderRow
        label="Blur"
        value={bg.blur}
        min={0}
        max={16}
        step={0.5}
        format={(v) => `${v.toFixed(1)}px`}
        disabled={disabled}
        onChange={(v) => onPatch({ blur: v, filterId: undefined })}
        onCommit={() => onPatch({}, true)}
      />
      <SliderRow
        label="Vignette"
        value={bg.vignette}
        min={0}
        max={1}
        step={0.05}
        disabled={disabled}
        onChange={(v) => onPatch({ vignette: v })}
        onCommit={() => onPatch({}, true)}
      />
      <SliderRow
        label="Grain"
        value={bg.grain}
        min={0}
        max={1}
        step={0.05}
        disabled={disabled}
        onChange={(v) => onPatch({ grain: v })}
        onCommit={() => onPatch({}, true)}
      />

      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Color overlay</span>
        <div className="grid grid-cols-4 gap-1.5">
          {OVERLAY_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              onClick={() => onPatch({ overlayId: preset.id }, true)}
              className={cn(
                "rounded-md border px-1 py-1.5 text-[10px] font-semibold transition-colors",
                bg.overlayId === preset.id
                  ? "border-primary bg-primary/12 text-primary"
                  : "border-border bg-secondary text-foreground hover:bg-accent"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {bg.overlayId !== "none" ? (
          <SliderRow
            label="Overlay"
            value={bg.overlayOpacity}
            min={0.05}
            max={1}
            step={0.05}
            disabled={disabled}
            onChange={(v) => onPatch({ overlayOpacity: v })}
            onCommit={() => onPatch({}, true)}
          />
        ) : null}
      </div>

      <div className="grid gap-2 rounded-md border border-border bg-background/40 p-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Framing
        </span>
        <SliderRow
          label="Zoom"
          value={bg.zoom}
          min={1}
          max={3}
          step={0.02}
          format={(v) => `${v.toFixed(2)}×`}
          disabled={disabled}
          onChange={(v) => onPatch({ zoom: v })}
          onCommit={() => onPatch({}, true)}
        />
        <p className="text-[11px] leading-relaxed text-muted-foreground/80">
          Zoom in, then drag the empty canvas to reframe. Flip mirrors the shot.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPatch({ flipH: !bg.flipH }, true)}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
              bg.flipH
                ? "border-primary bg-primary/12 text-primary"
                : "border-border bg-secondary text-foreground hover:bg-accent"
            )}
          >
            Flip horizontal
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPatch({ zoom: 1, offsetX: 0, offsetY: 0, flipH: false }, true)}
            className="rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            Reset framing
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- layers panel ----------

export function LayersPanel({
  layers,
  selectedId,
  disabled,
  onSelect,
  onToggleHidden,
  onDuplicate,
  onDelete,
  onMove,
}: {
  layers: ThumbLayer[];
  selectedId: string | undefined;
  disabled: boolean;
  onSelect: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: 1 | -1) => void;
}) {
  if (layers.length === 0) {
    return (
      <p className="text-xs text-muted-foreground/80">
        No layers yet — add text, a sticker, or a shape from the toolbar.
      </p>
    );
  }
  // Topmost layer first, like every design tool.
  const ordered = [...layers].reverse();
  return (
    <div className="grid gap-1">
      {ordered.map((layer) => (
        <div
          key={layer.id}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors",
            selectedId === layer.id
              ? "border-primary/70 bg-primary/10"
              : "border-transparent hover:bg-secondary"
          )}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(layer.id)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <span className="shrink-0 text-muted-foreground">
              {layer.type === "text" ? (
                <Type size={13} />
              ) : layer.type === "sticker" ? (
                <Smile size={13} />
              ) : (
                <Shapes size={13} />
              )}
            </span>
            <span className={cn("truncate font-medium", layer.hidden && "opacity-40")}>
              {layer.type === "text"
                ? layer.text.split("\n")[0].slice(0, 26) || "Empty text"
                : layer.type === "sticker"
                  ? layer.emoji
                  : layer.shape}
            </span>
          </button>
          <IconBtn title="Move up" disabled={disabled} onClick={() => onMove(layer.id, 1)}>
            <ArrowUp size={12} />
          </IconBtn>
          <IconBtn title="Move down" disabled={disabled} onClick={() => onMove(layer.id, -1)}>
            <ArrowDown size={12} />
          </IconBtn>
          <IconBtn
            title={layer.hidden ? "Show" : "Hide"}
            disabled={disabled}
            onClick={() => onToggleHidden(layer.id)}
          >
            {layer.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
          </IconBtn>
          <IconBtn title="Duplicate" disabled={disabled} onClick={() => onDuplicate(layer.id)}>
            <Copy size={12} />
          </IconBtn>
          <IconBtn title="Delete" destructive disabled={disabled} onClick={() => onDelete(layer.id)}>
            <Trash2 size={12} />
          </IconBtn>
        </div>
      ))}
    </div>
  );
}

function IconBtn({
  title,
  disabled,
  destructive,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        destructive && "hover:text-destructive"
      )}
    >
      {children}
    </button>
  );
}
