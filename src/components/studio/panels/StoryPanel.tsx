import { ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { replanReel, type Reel } from "@/api/reels";
import { listHorrorReferences, type HorrorReference } from "@/api/trends";
import type { ConfirmAction, StudioRun } from "@/components/studio/types";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelTitle } from "@/components/ui/panel";

export function StoryPanel({
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
  const [script, setScript] = useState(reel.providedScript ?? "");
  const [references, setReferences] = useState<HorrorReference[]>([]);
  const bible = reel.storyBible;
  const reelKey = reel._id ?? reel.id ?? "";

  useEffect(() => {
    void listHorrorReferences(12)
      .then(setReferences)
      .catch(() => setReferences([]));
  }, []);

  return (
    <div className="grid gap-3">
      <PanelTitle className="text-foreground">Story source</PanelTitle>

      {reel.horrorReference ? (
        <div className="rounded-md border border-border bg-card p-2.5 text-xs">
          <div className="font-medium text-foreground">Reference used</div>
          <a
            href={reel.horrorReference.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary"
          >
            {reel.horrorReference.title} <ExternalLink size={12} />
          </a>
          <span className="ml-1 text-muted-foreground/80">
            {reel.horrorReference.author
              ? `· ${reel.horrorReference.author}`
              : ""}{" "}
            {reel.horrorReference.license ?? ""}
          </span>
        </div>
      ) : null}

      {bible ? (
        <div className="grid gap-1 rounded-md border border-border bg-card p-2.5 text-xs">
          <div className="font-medium text-foreground">{bible.premise}</div>
          <div className="text-muted-foreground/80">
            Anchor: {bible.anchorObject} · Rule: {bible.impossibleRule}
          </div>
          <div className="text-muted-foreground/80">Twist: {bible.finalTwist}</div>
        </div>
      ) : null}

      <Label className="text-muted-foreground">
        Pick a scraped reference (optional)
        <Select
          disabled={busy}
          value={reel.horrorReferenceId ?? ""}
          onChange={(e) => {
            const horrorReferenceId = e.target.value;
            requestConfirm({
              title: "Re-plan with this reference?",
              body: "Discards the current plan and runs OpenRouter script planning again.",
              details: [
                "LLM planning credits will be charged.",
                "Existing scene assets are cleared until you approve and produce again.",
              ],
              confirmLabel: "Spend credits & re-plan",
              onConfirm: () => run(() => replanReel(reelKey, { horrorReferenceId })),
            });
          }}
        >
          <option value="">Auto / none</option>
          {references.map((r) => (
            <option key={r._id ?? r.sourceUrl} value={r._id ?? ""}>
              {r.title}
              {r.author ? ` — ${r.author}` : ""}
            </option>
          ))}
        </Select>
      </Label>

      <Label className="text-muted-foreground">
        Bring your own story (replaces AI script)
        <Textarea
          rows={5}
          value={script}
          disabled={busy}
          placeholder="Paste your full story here. It will be split into scenes, keeping your words."
          onChange={(e) => setScript(e.target.value)}
        />
      </Label>
      <Button
        type="button"
        variant="outline"
        className="border-border bg-secondary text-foreground hover:bg-accent"
        disabled={busy || !script.trim()}
        onClick={() =>
          requestConfirm({
            title: "Re-plan from your story?",
            body: "Structures your pasted story into scenes with OpenRouter, replacing the current plan.",
            details: [
              "LLM planning credits will be charged.",
              "Existing scene assets are cleared until you approve and produce again.",
            ],
            confirmLabel: "Spend credits & re-plan",
            onConfirm: () =>
              run(() =>
                replanReel(reelKey, {
                  providedScript: script.trim(),
                }),
              ),
          })
        }
      >
        <RefreshCw size={15} /> Re-plan from my story
      </Button>
    </div>
  );
}
