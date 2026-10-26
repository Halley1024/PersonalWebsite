import { request, type One } from "./client";
import type { Settings, AdminSettings, SettingsUpdate } from "./generated";
export const settingsApi = {
  public: (signal?: AbortSignal) =>
    request<One<Settings>>("/settings", { signal }),
  admin: (signal?: AbortSignal) =>
    request<One<AdminSettings>>("/admin/settings", { signal }),
  update: (body: SettingsUpdate) =>
    request<One<AdminSettings>>("/admin/settings", { method: "PUT", body }),
};
