import { request, type One } from "./client";
import type { PublicProfile, AdminProfile, ProfileUpdate } from "./generated";
export const profileApi = {
  public: (signal?: AbortSignal) =>
    request<One<PublicProfile>>("/profile", { signal }),
  admin: (signal?: AbortSignal) =>
    request<One<AdminProfile>>("/admin/profile", { signal }),
  update: (body: ProfileUpdate) =>
    request<One<AdminProfile>>("/admin/profile", { method: "PUT", body }),
};
