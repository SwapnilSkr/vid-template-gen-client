import { useCallback, useRef } from "react";

/** Throttle a callback — useful for high-frequency events like video `timeupdate`. */
export function useThrottledCallback<T extends (...args: never[]) => void>(
  callback: T,
  delayMs: number
): T {
  const callbackRef = useRef(callback);
  const lastRunRef = useRef(0);
  callbackRef.current = callback;

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastRunRef.current >= delayMs) {
        lastRunRef.current = now;
        callbackRef.current(...args);
      }
    }) as T,
    [delayMs]
  );
}
