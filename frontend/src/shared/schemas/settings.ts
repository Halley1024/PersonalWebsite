import { z } from "zod";
export const settingsSchema = z.object({
  site_name: z.string().trim().min(1, "请输入站点名称").max(80),
  site_description: z.string().max(300),
  footer_text: z.string().max(300),
  default_seo_title: z.string().min(1).max(70).nullable(),
  default_seo_description: z.string().min(1).max(160).nullable(),
  version: z.number().int().positive(),
});
