import { z } from "zod";
const month = z
  .string()
  .regex(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/, "请选择有效月份");
export const profileSchema = z.object({
  display_name: z.string().trim().min(1, "请输入显示名称").max(80),
  headline: z.string().max(160),
  intro: z.string().max(300),
  stats: z.object({
    experience: z.string().max(20),
    projects: z.string().max(20),
    notes: z.string().max(20),
  }),
  bio_markdown: z.string().max(20000),
  avatar_media_id: z.uuid().nullable(),
  location_label: z.string().max(100).nullable(),
  public_email: z.email().nullable(),
  social_links: z
    .array(
      z.object({
        label: z.string().min(1).max(40),
        url: z
          .string()
          .refine(
            (v) => /^(https:\/\/|mailto:)/.test(v),
            "请使用 HTTPS 或 mailto 链接",
          ),
      }),
    )
    .max(10),
  skill_groups: z
    .array(
      z.object({
        title: z.string().min(1).max(50),
        items: z.array(z.string().min(1).max(50)).max(20),
      }),
    )
    .max(10),
  experiences: z
    .array(
      z
        .object({
          id: z.uuid(),
          title: z.string().min(1).max(100),
          organization: z.string().max(120),
          start_date: month,
          end_date: month.nullable(),
          description: z.string().max(1000),
        })
        .refine(
          (v) => !v.end_date || v.end_date >= v.start_date,
          "结束月份不能早于开始月份",
        ),
    )
    .max(30),
  version: z.number().int().positive(),
});
