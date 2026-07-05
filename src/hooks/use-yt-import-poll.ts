import { useCallback, useEffect, useRef, useState } from "react";
import { getYtImport, type YtImport } from "@/api/yt-imports";
import { importNeedsPolling } from "@/utils/yt-import";

const POLL_MS = 3000;
const BURST_POLL_MS = 1000;
const BURST_DURATION_MS = 45_000;

/** Poll import state; dedupes in-flight requests and supports burst mode after frame extraction. */
export function useYtImportPoll(importId: string, initialData?: YtImport) {
  const [item, setItem] = useState<YtImport | null>(initialData ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const itemRef = useRef<YtImport | null>(initialData ?? null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const burstUntilRef = useRef(0);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;

    const run = (async () => {
      try {
        const data = await getYtImport(importId);
        itemRef.current = data;
        setItem(data);
        setError(undefined);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load import");
      } finally {
        setLoading(false);
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = run;
    return run;
  }, [importId]);

  const beginBurstPolling = useCallback(() => {
    burstUntilRef.current = Date.now() + BURST_DURATION_MS;
    void refresh();
  }, [refresh]);

  const patchItem = useCallback((patch: Partial<YtImport>) => {
    setItem((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      itemRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [importId, refresh]);

  useEffect(() => {
    const timer = setInterval(() => {
      const inBurst = Date.now() < burstUntilRef.current;
      if (inBurst || importNeedsPolling(itemRef.current)) {
        void refresh();
      }
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const burst = setInterval(() => {
      if (Date.now() < burstUntilRef.current) void refresh();
    }, BURST_POLL_MS);
    return () => clearInterval(burst);
  }, [refresh]);

  return { item, loading, error, refresh, beginBurstPolling, patchItem, setError };
}
