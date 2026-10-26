import { z } from "zod";
export const ruleSchema = z
  .object({
    scope: z.enum(["ip", "region"]),
    ip: z.string().nullable(),
    region_id: z.string().nullable(),
    reason: z.string().trim().min(1, "请填写封锁原因").max(200),
    enabled: z.boolean(),
    duration_hours: z.union([
      z.literal(1),
      z.literal(24),
      z.literal(168),
      z.null(),
    ]),
  })
  .superRefine((value, ctx) => {
    if (
      value.scope === "ip" &&
      !z.union([z.ipv4(), z.ipv6()]).safeParse(value.ip).success
    )
      ctx.addIssue({
        code: "custom",
        path: ["ip"],
        message: "请输入有效的 IPv4 或 IPv6 地址",
      });
    if (value.scope === "region" && !value.region_id)
      ctx.addIssue({
        code: "custom",
        path: ["region_id"],
        message: "请选择可封锁的区域",
      });
  });
