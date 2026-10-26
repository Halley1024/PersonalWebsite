import type { Kind } from "../api/content";
export const kindNames: Record<Kind, string> = {
  blog: "博客",
  project: "作品",
  life: "生活",
};
export const stateNames: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
  active: "生效中",
  expired: "已过期",
  disabled: "已禁用",
  idea: "构想中",
  building: "构建中",
  maintained: "持续维护",
  completed: "已完成",
};
export const isKind = (value: unknown): value is Kind =>
  value === "blog" || value === "project" || value === "life";
