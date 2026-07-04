import { useCallback, useEffect, useRef, useState } from "react";
import { getYtImport, type YtImport } from "@/api/yt-imports";

const TERMINAL_STATUSES = new Set<YtImport["status"]>(["completed", "failed"]);

/** Poll an import while it is in-flight; stops automatically when done. */
export function useYtImportPoll(importId: string, initialData?: YtImport) {
  const [item, setItem] = useState<YtImport | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | undefined>();
  const statusRef = useRef(initialData?.status);

  const refresh = useCallback(async () => {
    try {
      const data = await getYtImport(importId);
      statusRef.current = data.status;
      setItem(data);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load import");
    } finally {
      setLoading(false);
    }
  }, [importId]);

  useEffect(() => {
    if (!initialData) void refresh();
    const timer = setInterval(() => {
      if (!statusRef.current || !TERMINAL_STATUSES.has(statusRef.current)) {
        void refresh();
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [refresh, initialData]);

  return { item, loading, error, refresh, setError };
}
