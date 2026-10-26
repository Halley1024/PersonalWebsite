import { z } from "zod";
import { ApiError } from "../api/errors";
export function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const fields = Object.fromEntries(
    parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
  throw new ApiError(
    422,
    "VALIDATION_ERROR",
    parsed.error.issues[0]?.message || "请检查表单",
    fields,
  );
}
export const nullableUrl = z.union([
  z.url().refine((v) => v.startsWith("https://"), "链接必须使用 https://"),
  z.null(),
]);
export const nullableId = z.union([z.uuid(), z.null()]);
