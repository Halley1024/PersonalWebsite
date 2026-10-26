import { request, search, type One, type Page } from "./client";
import type { Analytics, Visit, Pageview } from "./generated";
export type VisitFilters = {
  start_date?: string;
  end_date?: string;
  q?: string;
  source?: string;
  region_id?: string;
  page?: number;
  page_size?: number;
};
export const analyticsApi = {
  get: (days = 7, signal?: AbortSignal) =>
    request<One<Analytics>>(`/admin/analytics${search({ days })}`, { signal }),
  visits: (filters: VisitFilters, signal?: AbortSignal) =>
    request<Page<Visit>>(`/admin/visits${search(filters)}`, { signal }),
  pageview: (body: Pageview) =>
    request<void>("/analytics/pageviews", {
      method: "POST",
      body,
      csrf: false,
    }),
};
