import type { AdminDetail, CreateContent } from "../../../api/generated";
import type { Kind } from "../../../api/content";
import { beijingDay } from "../../../utils/date";
export type ContentDraft = CreateContent & { version?: number };
export function emptyContent(kind: Kind): ContentDraft {
  return {
    kind,
    slug: "",
    title: "",
    excerpt: "",
    body_markdown: "",
    cover_media_id: null,
    category_id: null,
    tag_ids: [],
    featured: false,
    sort_order: 0,
    seo_title: null,
    seo_description: null,
    gallery: [],
    project:
      kind === "project"
        ? {
            tech_stack: [],
            project_stage: "building",
            started_on: beijingDay(),
            ended_on: null,
            repository_url: null,
            demo_url: null,
          }
        : null,
    life:
      kind === "life"
        ? { occurred_on: beijingDay(), location_label: null }
        : null,
  };
}
export function toDraft(item: AdminDetail): ContentDraft {
  return {
    kind: item.kind,
    slug: item.slug,
    title: item.title,
    excerpt: item.excerpt,
    body_markdown: item.body_markdown,
    cover_media_id: item.cover_media_id,
    category_id: item.category_id,
    tag_ids: item.tag_ids,
    featured: item.featured,
    sort_order: item.sort_order,
    seo_title: item.seo_title,
    seo_description: item.seo_description,
    gallery: item.gallery.map(({ media_id, alt, position }) => ({
      media_id,
      alt,
      position,
    })),
    project: item.project,
    life: item.life,
    version: item.version,
  };
}
