import { useInfiniteQuery } from "@tanstack/react-query";
import { contentApi } from "../../../../../shared/api/content";

export function useLifeFeed() {
  return useInfiniteQuery({
    queryKey: ["public", "life", "infinite", { page_size: 9 }],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      contentApi.list("life", { page: pageParam, page_size: 9 }, signal),
    getNextPageParam: (last) =>
      last.data.length > 0 && last.meta.page < last.meta.total_pages
        ? last.meta.page + 1
        : undefined,
  });
}
