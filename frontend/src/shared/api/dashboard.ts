import { request, type One } from "./client";
import type { Dashboard } from "./generated";
export const dashboardApi = {
  get: (signal?: AbortSignal) =>
    request<One<Dashboard>>("/admin/dashboard", { signal }),
};
