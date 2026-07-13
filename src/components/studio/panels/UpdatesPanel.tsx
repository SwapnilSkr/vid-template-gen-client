import { ExternalLink, Link2, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  applyReelUpdates,
  rescanReelUpdates,
  type Reel,
  type UpdateCandidate,
} from "@/api/reels";
import type { ConfirmAction, StudioRun } from "@/components/studio/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PanelTitle } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<UpdateCandidate["kind"], string> = {
  embedded_link: "Linked in post",
  author_post: "Author post",
  manual: "Manual link",
};

function ConfidenceBadge({ candidate }: { candidate: UpdateCandidate }) {
  if (candidate.kind === "manual") {
    return (
      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
        you added this
      </span>
    );
  }
  if (candidate.aiConfidence == null) {
    return (
      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
        signals only
      </span>
    );
  }
  const pct = Math.round(candidate.aiConfidence * 100);
  const strong = candidate.aiConfidence >= 0.7;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
        strong ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"
      )}
      title={candidate.aiReason ?? undefined}
    >
      AI {pct}%
    </span>
  );
}

export function UpdatesPanel({
  reel,
  busy,
  run,
  requestConfirm,
}: {
  reel: Reel;
  busy: boolean;
  run: StudioRun;
  requestConfirm: (action: ConfirmAction) => void;
}) {
  const reelKey = reel._id ?? reel.id ?? "";
  const discovery = reel.redditStory?.updateDiscovery;
  const isVerbatim = (reel.source ?? reel.storySource) === "verbatim";
  const isMultiPart = Boolean(reel.seriesId && (reel.partCount ?? 1) > 1);

  const includedKeys = (current = discovery) =>
    new Set([...(current?.includedKeys ?? []), ...(current?.candidates ?? []).filter((c) => c.kind === "manual").map((c) => c.key)]);
  const [included, setIncluded] = useState<Set<string>>(() => includedKeys());
  const [manualUrl, setManualUrl] = useState("");
  const [mode, setMode] = useState<"append" | "recut">(isMultiPart ? "append" : "recut");

  // Re-sync local selection whenever a fresh scan replaces the candidate list.
  useEffect(() => {
    setIncluded(includedKeys());
  }, [discovery?.scannedAt]);

  const candidates = discovery?.candidates ?? [];
  const dirty = useMemo(() => {
    const persisted = new Set(discovery?.includedKeys ?? []);
    if (persisted.size !== included.size) return true;
    for (const k of included) if (!persisted.has(k)) return true;
    return false;
  }, [discovery?.includedKeys, included]);

  const toggle = (key: string) =>
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const addedCount = useMemo(() => {
    const persisted = new Set(discovery?.includedKeys ?? []);
    return [...included].filter((k) => !persisted.has(k)).length;
  }, [discovery?.includedKeys, included]);

  const applyUpdates = () => {
    const effectiveMode = isMultiPart ? mode : "recut";
    requestConfirm({
      title: effectiveMode === "append" ? "Append updates as new part(s)?" : "Re-cut the story with updates?",
      body:
        effectiveMode === "append"
          ? "The newly-included follow-ups become new episodes appended after the current parts. Existing parts stay unchanged."
          : "Re-splits the original post plus every included update across the whole series for accurate pacing.",
      details: [
        "LLM cut-point planning credits may be charged.",
        effectiveMode === "append"
          ? "Only the new episodes are planned; existing episodes keep their assets."
          : "All parts are re-planned; their scene assets are cleared until you approve and produce again.",
      ],
      confirmLabel: "Spend credits & apply",
      costTone: "paid",
      onConfirm: () => run(() => applyReelUpdates(reelKey, { includedKeys: [...included], mode: effectiveMode })),
    });
  };

  return (
    <div className="grid gap-3">
      <PanelTitle className="text-foreground">Updates &amp; follow-ups</PanelTitle>
      <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
        Find the OP&apos;s later updates (their profile and links in the post), pick which to weave in,
        or paste a follow-up link you found yourself.
      </p>

      {/* Add a manual follow-up link */}
      <div className="grid gap-1.5 rounded-lg border border-border bg-black/15 p-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <Link2 size={15} /> Add update by link
        </span>
        <div className="flex gap-2">
          <Input
            value={manualUrl}
            disabled={busy}
            placeholder="https://www.reddit.com/…/comments/… or a /s/ share link"
            onChange={(e) => setManualUrl(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !manualUrl.trim()}
            onClick={() =>
              void run(async () => {
                const next = await rescanReelUpdates(reelKey, manualUrl.trim());
                setManualUrl("");
                return next;
              })
            }
          >
            Add
          </Button>
        </div>
      </div>

      {/* Re-scan */}
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => void run(() => rescanReelUpdates(reelKey))}
      >
        <RefreshCw size={15} /> {discovery ? "Re-scan for updates" : "Scan for updates"}
      </Button>

      {/* Candidate list */}
      {candidates.length ? (
        <div className="grid gap-2">
          {candidates.map((c) => (
            <label
              key={c.key}
              className={cn(
                "grid cursor-pointer gap-1 rounded-md border p-2.5 text-xs transition-colors",
                included.has(c.key) ? "border-primary bg-primary/[0.06]" : "border-border bg-card hover:bg-accent/40"
              )}
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={included.has(c.key)}
                  disabled={busy || c.kind === "manual"}
                  onChange={() => toggle(c.key)}
                />
                <div className="grid flex-1 gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {KIND_LABEL[c.kind]}
                    </span>
                    <ConfidenceBadge candidate={c} />
                    {c.decision === "rejected" ? (
                      <span className="text-[10px] text-muted-foreground/70">not a match</span>
                    ) : null}
                  </div>
                  <div className="font-medium text-foreground">{c.title}</div>
                  <div className="line-clamp-2 text-muted-foreground/80">{c.body.slice(0, 180)}</div>
                  <div className="flex flex-wrap items-center gap-1">
                    {c.matchedSignals.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-secondary/60 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground/80"
                      >
                        {s.replace(/_/g, " ")}
                      </span>
                    ))}
                    {c.url ? (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        open <ExternalLink size={10} />
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </label>
          ))}
        </div>
      ) : discovery ? (
        <p className="m-0 rounded-md border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground">
          No follow-ups found for this story yet.
        </p>
      ) : null}

      {/* Apply */}
      {candidates.length ? (
        <div className="grid gap-2 rounded-lg border border-border bg-black/15 p-3">
          {isMultiPart ? (
            <div className="grid gap-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground">How to fold updates in</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "append" ? "default" : "outline"}
                  disabled={busy}
                  onClick={() => setMode("append")}
                >
                  Append as new part(s)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "recut" ? "default" : "outline"}
                  disabled={busy}
                  onClick={() => setMode("recut")}
                >
                  Full re-cut
                </Button>
              </div>
              <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
                {mode === "append"
                  ? `Appends ${addedCount || "the new"} follow-up${addedCount === 1 ? "" : "s"} as new episode(s); existing parts stay untouched.`
                  : "Re-splits original + all included updates across every part for accurate pacing."}
              </p>
            </div>
          ) : null}
          {!isVerbatim ? (
            <p className="m-0 text-[11px] leading-relaxed text-amber-500">
              This is a {reel.source ?? reel.storySource} reel. Updates can inform its initial rewrite, but they cannot be appended or re-cut after that rewrite; choose a new source and re-plan instead.
            </p>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !dirty || !isVerbatim}
            onClick={applyUpdates}
          >
            <Sparkles size={15} /> Apply updates &amp; recompute parts
          </Button>
        </div>
      ) : null}
    </div>
  );
}
