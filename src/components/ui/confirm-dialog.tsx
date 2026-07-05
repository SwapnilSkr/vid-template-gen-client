import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ConfirmDialogAction {
  title: string;
  body: string;
  details?: string[];
  confirmLabel: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
}

interface ConfirmDialogProps {
  action?: ConfirmDialogAction;
  busy?: boolean;
  onClose: () => void;
}

export function ConfirmDialog({
  action,
  busy = false,
  onClose,
}: ConfirmDialogProps) {
  if (!action) return null;

  async function confirm() {
    if (!action) return;
    await action.onConfirm();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4 backdrop-blur-sm">
      <div className="grid w-full max-w-md gap-3 rounded-lg border border-border bg-card p-4 shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <strong className="text-base text-foreground">
              {action.title}
            </strong>
            <p className="m-0 text-sm leading-relaxed text-muted-foreground">
              {action.body}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={busy}
            onClick={onClose}
            title="Close"
          >
            <X size={16} />
          </Button>
        </div>

        {action.details?.length ? (
          <div className="grid gap-1 rounded-md border border-border bg-background/55 p-2.5 text-xs text-muted-foreground">
            {action.details.map((detail) => (
              <div key={detail} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{detail}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={
              action.variant === "destructive" ? "destructive" : "default"
            }
            disabled={busy}
            onClick={() => void confirm()}
          >
            {busy ? <Loader2 className="animate-spin" size={15} /> : null}
            {action.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
