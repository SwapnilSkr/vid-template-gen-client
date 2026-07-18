import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

/** A compact, reusable sheet for the inspector's intentionally detailed work.
 * The inspector itself stays scannable; editing opens only the controls that
 * belong to the selected workflow. */
export function StudioDialog({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="grid max-h-[calc(100dvh-2rem)] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-card shadow-pop"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="grid gap-1">
            <h2 className="m-0 text-sm font-semibold text-foreground">{title}</h2>
            <p className="m-0 text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>
          <Button type="button" size="icon" variant="ghost" aria-label={`Close ${title}`} onClick={onClose}>
            <X size={16} />
          </Button>
        </header>
        <div className="studio-scrollbar min-h-0 overflow-y-auto p-4">{children}</div>
      </section>
    </div>
    ,
    document.body,
  );
}
