import { z } from "zod";
import { nullableId, nullableUrl } from "./common";
const day = z.iso.date();
export const contentFields = z.object({
  title: z.string().trim().min(1, "请输入标题").max(120),
  excerpt: z.string().trim().min(1, "请输入摘要").max(300),
  body_markdown: z.string().max(200000),
  cover_media_id: nullableId,
  category_id: nullableId,
  tag_ids: z.array(z.uuid()).max(10),
  featured: z.boolean(),
  sort_order: z.number().int(),
  seo_title: z.string().min(1).max(70).nullable(),
  seo_description: z.string().min(1).max(160).nullable(),
  gallery: z
    .array(
      z.object({
        media_id: z.uuid(),
        alt: z.string().max(200),
        position: z.number().int().nonnegative(),
      }),
    )
    .max(20),
  project: z
    .object({
      tech_stack: z.array(z.string().trim().min(1).max(50)).max(20),
      project_stage: z.enum(["idea", "building", "maintained", "completed"]),
      started_on: day,
      ended_on: day.nullable(),
      repository_url: nullableUrl,
      demo_url: nullableUrl,
    })
    .refine(
      (v) => !v.ended_on || v.ended_on >= v.started_on,
      "项目结束日期不能早于开始日期",
    )
    .nullable(),
  life: z
    .object({
      occurred_on: day,
      location_label: z.string().max(100).nullable(),
    })
    .nullable(),
});
export const createContentSchema = contentFields.extend({
  kind: z.enum(["blog", "project", "life"]),
  slug: z
    .string()
    .min(1, "请输入 slug")
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug 仅支持小写英文、数字和连字符"),
});
export const updateContentSchema = contentFields.extend({
  version: z.number().int().positive(),
});
