import { useEffect, useState } from "react";
import { readDraft, writeDraft, removeDraft } from "../session/drafts";

type Snapshot<T> = { value: T; saved: string; history?: T[] };
export function useEditorState<T extends object>(key: string, initial: T, options: { history?: boolean } = {}) {
  const [snapshot, setSnapshot] = useState<Snapshot<T>>(
    () => readDraft<Snapshot<T>>(key) || {
      value: structuredClone(initial), saved: JSON.stringify(initial), history: [],
    },
  );
  const dirty = JSON.stringify(snapshot.value) !== snapshot.saved;
  useEffect(() => {
    if (dirty) writeDraft(key, snapshot);
    else removeDraft(key);
  }, [key, dirty, snapshot]);
  const setValue = (value: T | ((previous: T) => T)) => setSnapshot((previous) => {
    const next = typeof value === "function" ? value(previous.value) : value;
    if (JSON.stringify(next) === JSON.stringify(previous.value)) return previous;
    return {
      ...previous, value: next,
      history: options.history ? [...(previous.history ?? []).slice(-99), structuredClone(previous.value)] : [],
    };
  });
  const accept = (value: T) => {
    removeDraft(key);
    setSnapshot({ value: structuredClone(value), saved: JSON.stringify(value), history: [] });
  };
  const undo = () => setSnapshot((previous) => {
    if (!previous.history?.length) return previous;
    return { ...previous, value: previous.history[previous.history.length - 1], history: previous.history.slice(0, -1) };
  });
  const discard = () => {
    removeDraft(key);
    setSnapshot((previous) => ({ value: JSON.parse(previous.saved) as T, saved: previous.saved, history: [] }));
  };
  return { value: snapshot.value, setValue, dirty, accept, undo, discard, canUndo: !!snapshot.history?.length };
}
