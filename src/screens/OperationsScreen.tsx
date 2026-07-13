import { useCallback, useEffect, useRef, useState } from "react";
import { CheckSquare, ChevronDown, CircleAlert, Clipboard, Loader2, RefreshCw, Trash2 } from "lucide-react";
import {
  deleteOperationLog,
  deleteAllOperationLogs,
  deleteOperationLogs,
  listOperationLogs,
  type OperationLog,
  type OperationLogLevel,
  type OperationLogScope,
} from "@/api/operations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LEVELS: Array<OperationLogLevel | ""> = ["", "error", "warn", "info", "debug"];
const SCOPES: Array<OperationLogScope | ""> = ["", "api", "queue", "worker", "external", "system"];

function levelClass(level: OperationLogLevel): string {
  return {
    error: "border-destructive/50 bg-destructive/10 text-destructive",
    warn: "border-amber-500/50 bg-amber-500/10 text-amber-300",
    info: "border-primary/40 bg-primary/10 text-primary",
    debug: "border-border bg-muted text-muted-foreground",
  }[level];
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function metaText(log: OperationLog): string | undefined {
  const parts = [
    log.method && log.path ? `${log.method} ${log.path}` : undefined,
    log.status ? `HTTP ${log.status}` : undefined,
    log.durationMs !== undefined ? `${log.durationMs} ms` : undefined,
    log.reelId ? `Reel ${log.reelId}` : undefined,
    log.jobId ? `Job ${log.jobId}` : undefined,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

export function OperationsScreen() {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [nextBefore, setNextBefore] = useState<string>();
  const [level, setLevel] = useState<OperationLogLevel | "">("");
  const [scope, setScope] = useState<OperationLogScope | "">("");
  const [reelId, setReelId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();
  const requestVersion = useRef(0);

  const fetchPage = useCallback(async (append = false, before?: string) => {
    const version = ++requestVersion.current;
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const page = await listOperationLogs({
        limit: 50,
        before,
        level: level || undefined,
        scope: scope || undefined,
        reelId: reelId.trim() || undefined,
      });
      if (version !== requestVersion.current) return;
      setLogs((current) => append ? [...current, ...page.logs] : page.logs);
      setNextBefore(page.nextBefore);
      setSelected(new Set());
      setError(undefined);
    } catch (err) {
      if (version !== requestVersion.current) return;
      setError(err instanceof Error ? err.message : "Could not load operation logs");
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [level, reelId, scope]);

  useEffect(() => {
    void fetchPage();
  }, [fetchPage]);

  // The feed intentionally refreshes only while this screen is open. It avoids
  // background polling across the rest of Studio while still exposing live jobs.
  useEffect(() => {
    const timer = window.setInterval(() => void fetchPage(), 5_000);
    return () => window.clearInterval(timer);
  }, [fetchPage]);

  const toggleSelected = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const removeOne = useCallback(async (id: string) => {
    setDeleting(true);
    try {
      await deleteOperationLog(id);
      requestVersion.current += 1;
      setLogs((current) => current.filter((log) => log._id !== id));
      setSelected((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete log");
    } finally {
      setDeleting(false);
    }
  }, []);

  const removeSelected = useCallback(async () => {
    const ids = [...selected];
    if (!ids.length || !window.confirm(`Delete ${ids.length} selected log ${ids.length === 1 ? "entry" : "entries"}?`)) return;
    setDeleting(true);
    try {
      await deleteOperationLogs(ids);
      requestVersion.current += 1;
      const removed = new Set(ids);
      setLogs((current) => current.filter((log) => !removed.has(log._id)));
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete selected logs");
    } finally {
      setDeleting(false);
    }
  }, [selected]);

  const removeAll = useCallback(async () => {
    if (!window.confirm("Delete every Operations log permanently? This includes entries not currently loaded or matched by the filters.")) return;
    setDeleting(true);
    try {
      await deleteAllOperationLogs();
      // Cancel any in-flight poll that could otherwise restore stale rows.
      requestVersion.current += 1;
      setLogs([]);
      setNextBefore(undefined);
      setSelected(new Set());
      setExpanded(undefined);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete all logs");
    } finally {
      setDeleting(false);
    }
  }, []);

  return (
    <section className="mx-auto w-full max-w-6xl space-y-4 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-xl font-semibold tracking-tight">Operations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Recorded API failures and requests, queue transitions, worker outcomes, and fallbacks. Sensitive values are redacted before storage; successful log-management reads and deletes are omitted so this feed can be cleared.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void fetchPage()} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={() => void removeSelected()} disabled={!selected.size || deleting}>
            <Trash2 size={14} /> Delete selected ({selected.size})
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={() => void removeAll()} disabled={deleting}>
            <Trash2 size={14} /> Delete all logs
          </Button>
        </div>
      </header>

      <div className="grid gap-2 rounded-lg border border-border bg-card p-3 sm:grid-cols-[150px_150px_minmax(0,1fr)]">
        <label className="grid gap-1 text-xs text-muted-foreground">Level
          <select value={level} onChange={(event) => setLevel(event.target.value as OperationLogLevel | "")} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">
            {LEVELS.map((item) => <option key={item || "all"} value={item}>{item || "All levels"}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">Source
          <select value={scope} onChange={(event) => setScope(event.target.value as OperationLogScope | "")} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground">
            {SCOPES.map((item) => <option key={item || "all"} value={item}>{item || "All sources"}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">Reel ID
          <input value={reelId} onChange={(event) => setReelId(event.target.value)} placeholder="Filter a single reel" className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" />
        </label>
      </div>

      {error ? <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"><CircleAlert size={16} /> {error}</div> : null}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] gap-2 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
          <span><CheckSquare size={14} /></span><span>Activity</span><span>Actions</span>
        </div>
        {loading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Loading operations…</div> : null}
        {!loading && !logs.length ? <div className="min-h-48 p-5 text-sm text-muted-foreground">No logs match these filters yet.</div> : null}
        {!loading && logs.map((log) => {
          const isExpanded = expanded === log._id;
          const detail = log.error?.stack || (log.metadata ? JSON.stringify(log.metadata, null, 2) : undefined);
          return <article key={log._id} className="border-b border-border last:border-0">
            <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-2 px-3 py-3">
              <input aria-label={`Select ${log.event}`} type="checkbox" checked={selected.has(log._id)} onChange={() => toggleSelected(log._id)} className="mt-1 size-4 accent-primary" />
              <button type="button" onClick={() => setExpanded(isExpanded ? undefined : log._id)} className="min-w-0 text-left">
                <div className="flex flex-wrap items-center gap-1.5"><span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase", levelClass(log.level))}>{log.level}</span><span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{log.scope}</span><span className="text-sm font-medium text-foreground">{log.event}</span></div>
                <p className="mb-0 mt-1 break-words text-sm text-muted-foreground">{log.message}</p>
                <p className="mb-0 mt-1 text-xs text-muted-foreground">{formatTime(log.createdAt)}{metaText(log) ? ` · ${metaText(log)}` : ""}</p>
              </button>
              <div className="flex items-center gap-1"><Button type="button" size="icon" variant="ghost" className="size-8" aria-label={isExpanded ? "Hide details" : "Show details"} onClick={() => setExpanded(isExpanded ? undefined : log._id)}><ChevronDown size={15} className={isExpanded ? "rotate-180" : ""} /></Button><Button type="button" size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" aria-label="Delete log" onClick={() => void removeOne(log._id)} disabled={deleting}><Trash2 size={15} /></Button></div>
            </div>
            {isExpanded ? <div className="space-y-2 border-t border-border bg-muted/30 px-12 py-3"><p className="m-0 text-xs text-muted-foreground">Request {log.requestId ?? "—"}</p>{log.error?.message ? <p className="m-0 break-words text-sm text-destructive">{log.error.message}</p> : null}{detail ? <pre className="max-h-72 overflow-auto rounded bg-background p-3 text-xs text-foreground">{detail}</pre> : <p className="m-0 text-xs text-muted-foreground">No additional metadata captured.</p>}</div> : null}
          </article>;
        })}
      </div>
      {nextBefore ? <div className="flex justify-center"><Button type="button" variant="outline" onClick={() => void fetchPage(true, nextBefore)} disabled={loadingMore}>{loadingMore ? <Loader2 size={14} className="animate-spin" /> : <Clipboard size={14} />} Load older logs</Button></div> : null}
    </section>
  );
}
