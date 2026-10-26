import { useEffect, useState } from "react";
import { readDraft, writeDraft, removeDraft } from "../session/drafts";

type Snapshot<T> = { value: T; saved: string };
export function useEditorState<T extends object>(key: string, initial: T) {
  const [snapshot, setSnapshot] = useState<Snapshot<T>>(
    () =>
      readDraft<Snapshot<T>>(key) || {
        value: structuredClone(initial),
        saved: JSON.stringify(initial),
      },
  );
  const dirty = JSON.stringify(snapshot.value) !== snapshot.saved;
  useEffect(() => {
    if (dirty) writeDraft(key, snapshot);
    else removeDraft(key);
  }, [key, dirty, snapshot]);
  const setValue = (value: T | ((previous: T) => T)) =>
    setSnapshot((previous) => ({
      ...previous,
      value: typeof value === "function" ? value(previous.value) : value,
    }));
  const accept = (value: T) => {
    removeDraft(key);
    setSnapshot({
      value: structuredClone(value),
      saved: JSON.stringify(value),
    });
  };
  return { value: snapshot.value, setValue, dirty, accept };
}
