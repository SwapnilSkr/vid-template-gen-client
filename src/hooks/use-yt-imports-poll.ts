import { useCallback, useEffect, useRef, useState } from "react";
import { listYtImports, type YtImport } from "@/api/yt-imports";

const POLL_MS = 4000;

/** Poll the imports list — shared sidebar on the search screen. */
export function useYtImportsPoll() {
  const [imports, setImports] = useState<YtImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const inFlightRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;
    const run = (async () => {
      try {
        setImports(await listYtImports());
        setError(undefined);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load imports");
      } finally {
        setLoading(false);
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = run;
    return run;
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { imports, loading, error, refresh, setError };
}
