import { request, type One } from "./client";
import type {
  Session,
  LoginInput,
  LoginResult,
  PasswordInput,
} from "./generated";
export const authApi = {
  session: (signal?: AbortSignal) =>
    request<One<Session>>("/auth/session", { signal }),
  login: (body: LoginInput) =>
    request<One<LoginResult>>("/auth/login", {
      method: "POST",
      body,
      csrf: false,
    }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  password: (body: PasswordInput) =>
    request<void>("/admin/password", { method: "PUT", body }),
};
