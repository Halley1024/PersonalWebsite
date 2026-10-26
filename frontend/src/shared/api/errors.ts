export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: Record<string, string> = {},
    public requestId = "",
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "操作失败，请稍后重试";
export function shouldRetry(failureCount: number, error: unknown) {
  return (
    failureCount < 1 &&
    (!(error instanceof ApiError) || error.status === 0 || error.status >= 500)
  );
}
