import { useQuery } from "@tanstack/react-query";
import { contentApi, type Kind } from "../../../api/content";
import type { PublicCard } from "../../../api/generated";

export type AdjacentContent = Pick<PublicCard, "id" | "slug" | "title">;
export type AdjacentContents = { previous: AdjacentContent | null; next: AdjacentContent | null };
const PAGE_SIZE = 50;

// 使用公开列表的同一顺序查找相邻内容，不受用户当前列表页码影响。
export async function loadAdjacentContents(kind: Kind, id: string, signal?: AbortSignal): Promise<AdjacentContents> {
  let preceding: PublicCard | null = null;
  for (let page = 1; ; page += 1) {
    const result = await contentApi.list(kind, { page, page_size: PAGE_SIZE }, signal);
    const index = result.data.findIndex((entry) => entry.id === id);
    if (index >= 0) {
      const previous = index > 0 ? result.data[index - 1] : preceding;
      if (index + 1 < result.data.length) return { previous, next: result.data[index + 1] };
      if (page >= result.meta.total_pages) return { previous, next: null };
      const following = await contentApi.list(kind, { page: page + 1, page_size: PAGE_SIZE }, signal);
      if (!following.data.length) throw new Error("内容列表已更新，请重试。");
      return { previous, next: following.data[0] };
    }
    if (!result.data.length || page >= result.meta.total_pages) break;
    preceding = result.data[result.data.length - 1];
  }
  throw new Error("暂时无法确定相邻内容，请重试。");
}

export function useAdjacentContents(kind: Kind, id: string) {
  return useQuery({
    queryKey: ["public", "adjacent-contents", kind, id],
    queryFn: ({ signal }) => loadAdjacentContents(kind, id, signal),
    staleTime: 30_000,
  });
}
