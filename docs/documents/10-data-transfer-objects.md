# 前后端传输数据结构

上级文档：[开发总览](README.md)。HTTP 路径和字段限制以 [05](05-api-contract.md) 为准；数据库模型见 [06](06-data-storage.md)。以下 TypeScript 是语言无关契约说明；当前后端的 [OpenAPI](../../backend/openapi.json) 及 [生成类型](../../backend/docs/api-types.ts) 已提供，尚未作为前端 SDK 接入。经历月份字段按用户选择命名为 start_date/end_date，值仍为 YYYY-MM。

## 1. 数据经过的四层

```text
编辑表单（字符串、File、UI 状态）
  → 请求 DTO（关联 ID、完整字段、version）
  → Rust service / 数据库实体（存储键、外键、事务）
  → 响应 DTO（公开摘要或管理详情）→ 页面组件
```

禁止将数据库实体直接序列化给浏览器，也不直接把表单 state 或 GET 返回值原样 PUT。表单适配负责 works→project、空值规范化及关联 ID 提取；service 负责最终校验。所有日期为有效日历日期，月份为 YYYY-MM；时间点统一 UTC。

## 2. 基础类型与响应

```ts
type UUID = string;          // 有效 UUID；不是原型的 work-xxx/experience-xxx
type Instant = string;       // RFC 3339 UTC，如 2026-10-25T02:00:00Z
type LocalDate = string;     // YYYY-MM-DD
type YearMonth = string;     // YYYY-MM
type Kind = 'blog' | 'project' | 'life';
type Status = 'draft' | 'published' | 'archived';
type Stage = 'idea' | 'building' | 'maintained' | 'completed';
interface One<T> { data: T }
interface Page<T> {
  data: T[];
  meta: { page: number; page_size: number; total: number; total_pages: number };
}
interface ApiError {
  error: {
    code: string; message: string;
    fields: Record<string, string>; // 无字段错误时为空对象；嵌套路径如 project.started_on
    request_id: string;
  };
}
interface MediaSummary {
  id: UUID; url: string; width: number; height: number; alt: string;
}
interface TaxonomySummary { id: UUID; name: string; slug: string }
interface GalleryInput { media_id: UUID; alt: string; position: number }
interface GalleryItem { media: MediaSummary; alt: string; position: number }
interface Project {
  tech_stack: string[]; project_stage: Stage;
  started_on: LocalDate; ended_on: LocalDate | null;
  repository_url: string | null; demo_url: string | null;
}
interface Life { occurred_on: LocalDate; location_label: string | null }
```

204 没有响应体，前端不调用 response.json()。其他错误沿用 ApiError；媒体成功为二进制。URL 为服务端提供的同源相对路径，客户端不可提交 storage_key 或服务器路径。

## 3. 内容请求

```ts
interface ContentFields {
  title: string; excerpt: string; body_markdown: string;
  cover_media_id: UUID | null; category_id: UUID | null; tag_ids: UUID[];
  featured: boolean; sort_order: number;
  seo_title: string | null; seo_description: string | null;
  gallery: GalleryInput[];
}
type ContentVariant =
  | { kind: 'blog'; project: null; life: null }
  | { kind: 'project'; project: Project; life: null }
  | { kind: 'life'; project: null; life: Life };
type CreateContent = ContentFields & ContentVariant & { slug: string };
type UpdateContent = ContentFields & {
  project: Project | null; life: Life | null; version: number;
};
interface ChangeStatus { status: Status; version: number }
```

更新通过资源 ID 已知 kind，不能提交 kind/slug/status/published_at；服务端据已有 kind 校验 project/life。blog 的 gallery=[]，project/life 为 null；project 必须有 project 对象，life 必须有 life 对象。gallery.alt 为字符串，空串时读取回退到媒体默认 alt。

创建作品示例（ID 由服务端生成）：

```json
{
  "kind": "project", "slug": "personal-website", "title": "个人网站",
  "excerpt": "个人内容发布与管理。", "body_markdown": "# 项目说明\n\n实现过程。",
  "cover_media_id": null, "category_id": null, "tag_ids": [],
  "featured": true, "sort_order": 0,
  "seo_title": null, "seo_description": null, "gallery": [],
  "project": {
    "tech_stack": ["Rust", "React"], "project_stage": "building",
    "started_on": "2026-10-25", "ended_on": null,
    "repository_url": null, "demo_url": null
  },
  "life": null
}
```

## 4. 内容读取

```ts
interface CardBase {
  id: UUID; kind: Kind; slug: string; title: string; excerpt: string;
  cover: MediaSummary | null; category: TaxonomySummary | null;
  tags: TaxonomySummary[]; featured: boolean;
  published_at: Instant; updated_at: Instant;
}
type ContentCard =
  | (CardBase & { kind: 'blog' })
  | (CardBase & { kind: 'project'; tech_stack: string[]; project_stage: Stage;
      started_on: LocalDate; ended_on: LocalDate | null })
  | (CardBase & { kind: 'life'; occurred_on: LocalDate; location_label: string | null });
type PublicDetail = ContentCard & {
  body_markdown: string; seo_title: string | null; seo_description: string | null;
  gallery: GalleryItem[];
} & ContentVariant;
type AdminDetail = ContentFields & ContentVariant & {
  id: UUID; slug: string; status: Status; version: number;
  created_at: Instant; updated_at: Instant; published_at: Instant | null;
  cover: MediaSummary | null; category: TaxonomySummary | null;
  tags: TaxonomySummary[];
};
// 管理列表不取正文、图库和关联 ID；公开摘要字段之外返回管理状态。
type AdminCard = Omit<CardBase, 'published_at'> & {
  status: Status; version: number; created_at: Instant; published_at: Instant | null;
  project: Project | null; life: Life | null;
};
```

管理 gallery 的基本形状为 GalleryInput，若附带 media 只读摘要，前端 PUT 必须剔除。公开详情无关联 ID 数组、内部 version、status、存储键；project/life 的卡片摘要与详情对象来自同一数据源，不独立编辑。

发布响应示例的流程：创建返回 One<AdminDetail>（201，draft/version=1）；状态请求 `{status:"published",version:1}` 返回同形对象（200，version=2）；公开详情为 One<PublicDetail>。保存结果更新前端当前 version，禁止再次使用旧版本。

## 5. 个人资料与经历

```ts
interface Experience {
  id: UUID; title: string; organization: string;
  start_date: YearMonth; end_date: YearMonth | null; description: string;
}
interface ProfileFields {
  display_name: string; headline: string; intro: string; bio_markdown: string;
  stats: { experience: string; projects: string; notes: string };
  avatar_media_id: UUID | null; location_label: string | null;
  public_email: string | null;
  social_links: { label: string; url: string }[];
  skill_groups: { title: string; items: string[] }[];
  experiences: Experience[];
}
type ProfileUpdate = ProfileFields & { version: number };
type AdminProfile = ProfileUpdate & { avatar: MediaSummary | null; updated_at: Instant };
type PublicProfile = Omit<ProfileFields, 'avatar_media_id'> & { avatar: MediaSummary | null };
interface SettingsFields {
  site_name: string; site_description: string; footer_text: string;
  default_seo_title: string | null; default_seo_description: string | null;
}
type SettingsUpdate = SettingsFields & { version: number };
type AdminSettings = SettingsUpdate & { updated_at: Instant };
```

公开 settings 返回 SettingsFields。经历按数组顺序展示；UI “持续至今”由 end_date=null 推导，不另存可能矛盾的 ongoing。stats 是展示字符串（例如“4+”），不是访问统计或自动计算的项目总数，禁止把原型数字当实绩。

个人介绍页和经历页共用 ProfileUpdate；经历新建/删除/排序都修改同一集合并提交最新整体版本。客户端新建经历可生成 UUID，服务器校验重复 ID。撤销删除属于再次提交原位置条目，也必须通过 version 校验。

## 6. 会话、媒体、分类及工作台

```ts
interface AdminIdentity { id: UUID; username: string }
interface LoginResult { admin: AdminIdentity; csrf_token: string; expires_at: Instant }
type SessionResult = { authenticated: false }
  | ({ authenticated: true } & LoginResult);
interface MediaRecord extends MediaSummary {
  thumbnail_url: string; mime_type: 'image/jpeg' | 'image/png' | 'image/webp';
  byte_size: number; created_at: Instant; reference_count: number;
}
interface TaxonomyRecord extends TaxonomySummary {
  kind: Kind; version: number; created_at: Instant; updated_at: Instant;
}
type CategoryRecord = TaxonomyRecord & { sort_order: number };
interface Dashboard {
  counts: { kind: Kind; draft: number; published: number; archived: number }[];
  recent_contents: AdminCard[]; // 最近更新 10 项，updated_at DESC, id DESC
}
```

登录 POST `{username,password}`，密码修改 PUT `{current_password,new_password}`。上传用 FormData 的 file/alt 字段，不发送 Base64 JSON。分类创建 `{kind,name,slug,sort_order}`，更新去掉 kind 加 version；标签相同但没有 sort_order；删除 version 放查询参数。统计、Visit、AccessRule 对象统一见 [11](11-analytics-and-access-control.md)，不在两处重复定义。
