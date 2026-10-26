import { request, search, type One, type Page } from "./client";
import type {
  PublicCard,
  PublicDetail,
  AdminCard,
  AdminDetail,
  CreateContent,
  UpdateContent,
  ChangeStatus,
} from "./generated";
export type Kind = "blog" | "project" | "life";
export const paths: Record<Kind, string> = {
  blog: "posts",
  project: "projects",
  life: "life",
};
export type PublicFilters = {
  page?: number;
  page_size?: number;
  q?: string;
  category?: string;
  tag?: string;
  featured?: boolean;
};
export type AdminFilters = Omit<PublicFilters, "featured"> & {
  kind?: Kind;
  status?: string;
  sort?: string;
};
export const contentApi = {
  list: (kind: Kind, filters: PublicFilters = {}, signal?: AbortSignal) =>
    request<Page<PublicCard>>(`/${paths[kind]}${search(filters)}`, { signal }),
  detail: (kind: Kind, slug: string, signal?: AbortSignal) =>
    request<One<PublicDetail>>(`/${paths[kind]}/${encodeURIComponent(slug)}`, {
      signal,
    }),
  adminList: (filters: AdminFilters = {}, signal?: AbortSignal) =>
    request<Page<AdminCard>>(`/admin/contents${search(filters)}`, { signal }),
  adminDetail: (id: string, signal?: AbortSignal) =>
    request<One<AdminDetail>>(`/admin/contents/${id}`, { signal }),
  create: (body: CreateContent) =>
    request<One<AdminDetail>>("/admin/contents", { method: "POST", body }),
  update: (id: string, body: UpdateContent) =>
    request<One<AdminDetail>>(`/admin/contents/${id}`, { method: "PUT", body }),
  status: (id: string, body: ChangeStatus) =>
    request<One<AdminDetail>>(`/admin/contents/${id}/status`, {
      method: "POST",
      body,
    }),
  remove: (id: string, version: number) =>
    request<void>(`/admin/contents/${id}${search({ version })}`, {
      method: "DELETE",
    }),
};
