import { request, search, type One, type Page } from "./client";
import type { Region, AccessRule, RuleCreate, RuleUpdate } from "./generated";
export type RuleFilters = {
  scope?: string;
  state?: string;
  q?: string;
  page?: number;
  page_size?: number;
};
export const accessApi = {
  regions: (signal?: AbortSignal) =>
    request<One<Region[]>>("/admin/regions", { signal }),
  list: (filters: RuleFilters = {}, signal?: AbortSignal) =>
    request<Page<AccessRule>>(`/admin/access-rules${search(filters)}`, {
      signal,
    }),
  create: (body: RuleCreate) =>
    request<One<AccessRule>>("/admin/access-rules", { method: "POST", body }),
  update: (id: string, body: RuleUpdate) =>
    request<One<AccessRule>>(`/admin/access-rules/${id}`, {
      method: "PUT",
      body,
    }),
  remove: (id: string, version: number) =>
    request<void>(`/admin/access-rules/${id}${search({ version })}`, {
      method: "DELETE",
    }),
};
