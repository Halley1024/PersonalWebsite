import { z } from "zod";
export const loginSchema = z.object({
  username: z.string().trim().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码"),
});
export const passwordSchema = z.object({
  current_password: z.string().min(1, "请输入当前密码"),
  new_password: z
    .string()
    .min(8, "新密码至少 8 个字符")
    .max(128, "新密码最多 128 个字符"),
});
