import { ApiError } from "./errors";
let csrfToken: string | null = null; // 只在内存中保存 CSRF token，不使用 localStorage。
export function setCsrfToken(token: string | null) {
  csrfToken = token;
}
type Options = {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  csrf?: boolean;
};
export async function request<T>(
  path: string,
  { method = "GET", body, signal, csrf = true }: Options = {},
): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  const multipart = body instanceof FormData;
  if (body !== undefined && !multipart)
    headers.set("Content-Type", "application/json");
  if (method !== "GET" && method !== "HEAD" && csrf && csrfToken)
    headers.set("X-CSRF-Token", csrfToken);
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : multipart
            ? body
            : JSON.stringify(body),
      credentials: "same-origin",
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(0, "NETWORK_ERROR", "无法连接服务，请检查网络后重试");
  }
  if (!response.ok) {
    const json = await response.json().catch(() => null);
    const data = json?.error;
    if (response.status === 401 && data?.code !== "INVALID_CREDENTIALS")
      window.dispatchEvent(new Event("session:expired"));
    throw new ApiError(
      response.status,
      data?.code ?? "HTTP_ERROR",
      data?.message ?? `请求失败（${response.status}）`,
      data?.fields ?? {},
      data?.request_id ?? response.headers.get("x-request-id") ?? "",
    );
  }
  if (response.status === 204) return undefined as T;
  const json = await response.json().catch(() => {
    throw new ApiError(502, "INVALID_RESPONSE", "服务返回了无法识别的数据");
  });
  return json as T;
}
export type One<T> = { data: T };
export type Page<T> = {
  data: T[];
  meta: { page: number; page_size: number; total: number; total_pages: number };
};
export function search(params: object): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "")
      query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}
