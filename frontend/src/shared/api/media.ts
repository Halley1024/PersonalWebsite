import { request, search, type One, type Page } from "./client";
import type { Media, MediaStats } from "./generated";
export type MediaFilters = { page?: number; page_size?: number; unused?: boolean; kind?: "blog" | "project" | "life"; q?: string };
export const mediaApi = {
  stats: (signal?: AbortSignal) => request<One<MediaStats>>("/admin/media/stats", { signal }),
  list: (
    params: MediaFilters = {},
    signal?: AbortSignal,
  ) => request<Page<Media>>(`/admin/media${search(params)}`, { signal }),
  upload: (file: File, alt = "") => {
    const body = new FormData();
    body.append("file", file);
    body.append("alt", alt);
    return request<One<Media>>("/admin/media", { method: "POST", body });
  },
  remove: (id: string) =>
    request<void>(`/admin/media/${id}`, { method: "DELETE" }),
};
