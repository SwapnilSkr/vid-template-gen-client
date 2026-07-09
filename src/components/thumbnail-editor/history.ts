import { useCallback, useRef, useState } from "react";
import type { ThumbDoc } from "./doc";

const MAX_HISTORY = 80;

export interface DocHistory {
  doc: ThumbDoc;
  /** Synchronously-current doc — safe to read inside event handlers that fire
   *  before React re-renders (rapid clicks, same-tick multi-patches). */
  latestRef: React.RefObject<ThumbDoc>;
  /** Live update without a history entry — for drags/slider scrubs. */
  preview: (next: ThumbDoc) => void;
  /** Update + push the previous committed state onto the undo stack. */
  commit: (next: ThumbDoc) => void;
  /** Swap the whole doc and wipe history (draft restore, reel switch). */
  replaceAll: (next: ThumbDoc) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/** Undo/redo over immutable doc snapshots. Transient `preview` updates don't
 *  pollute the stack — pointer-up / input-change calls `commit`, so one drag
 *  is one undo step. */
export function useDocHistory(initial: ThumbDoc): DocHistory {
  const [doc, setDoc] = useState(initial);
  const [stackVersion, setStackVersion] = useState(0);
  const past = useRef<ThumbDoc[]>([]);
  const future = useRef<ThumbDoc[]>([]);
  const committed = useRef(initial);
  const latestRef = useRef(initial);

  const preview = useCallback((next: ThumbDoc) => {
    latestRef.current = next;
    setDoc(next);
  }, []);

  const commit = useCallback((next: ThumbDoc) => {
    past.current.push(committed.current);
    if (past.current.length > MAX_HISTORY) past.current.shift();
    future.current = [];
    committed.current = next;
    latestRef.current = next;
    setDoc(next);
    setStackVersion((v) => v + 1);
  }, []);

  const replaceAll = useCallback((next: ThumbDoc) => {
    past.current = [];
    future.current = [];
    committed.current = next;
    latestRef.current = next;
    setDoc(next);
    setStackVersion((v) => v + 1);
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(committed.current);
    committed.current = prev;
    latestRef.current = prev;
    setDoc(prev);
    setStackVersion((v) => v + 1);
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(committed.current);
    committed.current = next;
    latestRef.current = next;
    setDoc(next);
    setStackVersion((v) => v + 1);
  }, []);

  void stackVersion; // state only forces re-render so canUndo/canRedo stay fresh
  return {
    doc,
    latestRef,
    preview,
    commit,
    replaceAll,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
