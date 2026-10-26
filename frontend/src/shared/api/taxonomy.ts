import { request, search, type One, type Page } from "./client";
import type {
  TaxonomySummary,
  Category,
  Tag,
  CategoryCreate,
  CategoryUpdate,
  TagCreate,
  TagUpdate,
} from "./generated";
import type { Kind } from "./content";
export type TaxonomyType = "categories" | "tags";
export type TaxonomyRow = Category | Tag;
export const taxonomyApi = {
  public: (type: TaxonomyType, kind: Kind, signal?: AbortSignal) =>
    request<One<TaxonomySummary[]>>(`/${type}${search({ kind })}`, { signal }),
  list: (
    type: TaxonomyType,
    params: { kind?: Kind; page?: number; page_size?: number },
    signal?: AbortSignal,
  ) =>
    request<Page<TaxonomyRow>>(`/admin/${type}${search(params)}`, { signal }),
  create: (type: TaxonomyType, body: CategoryCreate | TagCreate) =>
    request<One<TaxonomyRow>>(`/admin/${type}`, { method: "POST", body }),
  update: (type: TaxonomyType, id: string, body: CategoryUpdate | TagUpdate) =>
    request<One<TaxonomyRow>>(`/admin/${type}/${id}`, { method: "PUT", body }),
  remove: (type: TaxonomyType, id: string, version: number) =>
    request<void>(`/admin/${type}/${id}${search({ version })}`, {
      method: "DELETE",
    }),
};
