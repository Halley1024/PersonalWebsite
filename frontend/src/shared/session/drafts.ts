const drafts = new Map<string, unknown>(); // 仅保存在当前标签页内存，刷新即丢失，不落 localStorage。
export const readDraft = <T>(key: string) => drafts.get(key) as T | undefined;
export const writeDraft = (key: string, value: unknown) =>
  drafts.set(key, structuredClone(value));
export const removeDraft = (key: string) => drafts.delete(key);
export const clearDrafts = () => drafts.clear();
