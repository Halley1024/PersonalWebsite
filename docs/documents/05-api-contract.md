# HTTP API 契约

上级文档：[开发总览](README.md)。本文为接口设计契约；当前后端对应 [OpenAPI](../../backend/openapi.json)，生成脚本会检查实际路由路径和方法。前端接入与生产部署尚待验收。所有下表路径除特别注明外，均位于 `/api/v1` 下。

完整共享对象与请求/响应差异见 [10 传输数据结构](10-data-transfer-objects.md)。流量、访问明细和封锁规则的接口/字段见 [11](11-analytics-and-access-control.md)，同样属于本契约。

## 1. 通用约定

JSON 使用 snake_case、UTF-8。UUID 以字符串传输，时间为 UTC RFC 3339，如 `2026-10-24T13:00:00Z`；日期为 `YYYY-MM-DD`。枚举为小写字符串。整数 version 从 1 开始；删除操作通过查询参数 `version` 提交预期版本。

成功单条响应为 `{"data": {...}}`，列表为 `{"data": [...], "meta": {"page": 1, "page_size": 12, "total": 30, "total_pages": 3}}`。空列表返回 200、data=[]、total_pages=0。创建返回 201 及 Location，更新返回 200，删除/退出返回 204 无 body；媒体二进制、健康检查、sitemap 是特例。

所有 API 和媒体响应含 `Cache-Control: no-store`。所有响应应带 `X-Request-Id`；API 不把业务失败包装成 HTTP 200。

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请检查输入字段",
    "fields": {"title": "标题不能为空"},
    "request_id": "req-example"
  }
}
```

| HTTP | code 示例 | 处理 |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | JSON 格式、非法分页/枚举/UUID |
| 401 | `UNAUTHENTICATED` / `INVALID_CREDENTIALS` | 无有效会话或登录失败 |
| 403 | `CSRF_FAILED` / `ORIGIN_FORBIDDEN` / `ACCESS_DENIED` | 来源或 token 不匹配，或公开访问命中封锁规则 |
| 404 | `NOT_FOUND` | 资源不存在或非公开内容 |
| 409 | `VERSION_CONFLICT` / `SLUG_CONFLICT` / `RESOURCE_IN_USE` / `INVALID_STATE` | 提示刷新、改 slug 或解除引用 |
| 413 | `PAYLOAD_TOO_LARGE` | 请求或文件过大 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 不允许的文件类型或请求类型 |
| 422 | `VALIDATION_ERROR` | 字段格式、缺失关联、发布校验失败 |
| 429 | `RATE_LIMITED` | 携带 Retry-After |
| 500/503 | `INTERNAL_ERROR` / `SERVICE_UNAVAILABLE` | 显示 request_id；不公开 SQL 或堆栈 |

所有错误统一返回上述字段，fields 无字段错误时为 {}。

## 2. 公开查询

| 方法 | 路径 | 查询与响应 |
| --- | --- | --- |
| GET | `/profile` | 完整公开个人资料；无密码、登录名等管理员信息 |
| GET | `/settings` | 站点名、描述、页脚与公开 SEO 默认值 |
| GET | `/posts` | 博客卡片列表 |
| GET | `/posts/{slug}` | 已发布博客详情 |
| GET | `/projects` | 作品卡片列表，包含技术栈/项目阶段 |
| GET | `/projects/{slug}` | 已发布作品详情，包含相册和外链 |
| GET | `/life` | 生活卡片列表，包含发生日期和可选地点 |
| GET | `/life/{slug}` | 已发布生活详情及相册 |
| GET | `/categories?kind=blog` | 指定 kind 中至少有一条已发布引用的分类 |
| GET | `/tags?kind=blog` | 指定 kind 中至少有一条已发布引用的标签 |
| GET | `/media/{id}?variant=original` | 图片二进制；variant 仅允许 original/thumb，默认 original |

公开列表支持 `page`（默认 1）、`page_size`（默认 12，上限 50）、`q`（标题/摘要字面子串，最长 100）、`category`（分类 slug）、`tag`（单个标签 slug）、`featured`（可选 true/false）。排序固定为需求文档定义，不接受任意字段。页码超过末页返回空列表；非法参数返回 400。公开接口不接受 `status` 或管理排序字段，未知查询参数返回 400。

公开分类/标签为 One<TaxonomySummary[]>，仅支持必填 kind，按 name/id 升序，不分页；管理分类/标签为分页对象，字段见 [10](10-data-transfer-objects.md)。内容列表均为 Page<ContentCard>，管理列表为 Page<AdminCard>；详情及其他单对象响应均包裹 data。

个人资料 DTO：`display_name`、`headline`、`intro`、`stats`、`bio_markdown`、`avatar`、`location_label`、`public_email`、`social_links`、`skill_groups`、`experiences`。avatar 为 `{id,url,width,height,alt}` 或 null；其余复合字段见数据文档。公开版不返回 version，后台版返回 version、updated_at。

公开内容卡片：`id`、`kind`、`slug`、`title`、`excerpt`、`cover`、`category`、`tags`、`featured`、`published_at`、`updated_at`，以及对应类型的摘要扩展。详情再增加 `body_markdown`、`seo_title`、`seo_description`、`gallery` 和类型扩展；不返回 version、内部审计或媒体存储键。

后台内容详情在可编辑字段基础上返回 `id`、`kind`、固定 `slug`、`status`、`version`、`created_at`、`updated_at`、`published_at`，并补充只读的 cover/category/tags 摘要供展示。后台 gallery 使用写入形状 `{media_id,alt,position}`，可额外带只读 media 摘要；PUT 前剔除只读字段。作品卡片返回 `tech_stack`、`project_stage`、`started_on`、`ended_on`，作品详情的 `project` 对象包含全部作品字段；生活卡片返回 `occurred_on`、`location_label`，详情的 `life` 对象包含同名字段。

category 为 `{id,name,slug}` 或 null，tags 为同形对象数组；cover 为媒体摘要或 null，gallery 为 `[{media:{id,url,width,height,alt},alt,position}]`。其中 gallery.alt 为该内容内覆盖的替代文本，写入空串时读取回退为媒体 alt。

公开 profile/settings 在初始化后始终有记录；内容为空时返回空列表，不提供未确认的示例资料。

## 3. 会话与密码

| 方法 | 路径 | 请求/行为 |
| --- | --- | --- |
| POST | `/auth/login` | `{username,password}`；200 设置 Session Cookie，返回 `{data:{admin:{id,username},csrf_token,expires_at}}` |
| GET | `/auth/session` | 已登录返回 `{data:{authenticated:true,admin,csrf_token,expires_at}}`；未登录 200 返回 `{data:{authenticated:false}}` |
| POST | `/auth/logout` | 已登录且带 CSRF；删除当前会话、清 Cookie、204 |
| PUT | `/admin/password` | `{current_password,new_password}`；会话+CSRF，成功撤销全部会话、清 Cookie、204，要求重新登录 |

login 需要完全匹配的 Origin 和 `application/json`，不要求尚不存在的会话 CSRF；其他管理写请求同时要求会话 Cookie、合法 Origin、`X-CSRF-Token`。会话过期后 logout 返回 401，前端清理本地登录显示。所有会话响应 no-store，禁止将 csrf_token 放 URL。

## 4. 管理接口列表

所有 `/admin/*` 接口都需要管理员会话，所有写入额外需要 CSRF 和 Origin。GET 不改变内容业务状态。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/admin/dashboard` | 按 kind/status 统计、最近更新内容；不是流量统计 |
| GET | `/admin/analytics`、`/admin/visits` | 真实流量汇总/明细，见 11 |
| GET / POST | `/admin/access-rules` | 查询/创建规则，见 11 |
| PUT / DELETE | `/admin/access-rules/{id}` | version 保护的更新/删除，见 11 |
| GET | `/admin/regions` | 可用于筛选和封锁的规范区域目录，见 11 |
| GET / PUT | `/admin/profile` | 查询/完整更新个人资料，PUT 带 version |
| GET / PUT | `/admin/settings` | 查询/完整更新公开站点设置，PUT 带 version |
| GET | `/admin/contents` | 全状态列表；kind/status/q/category/tag/page/page_size/sort |
| POST | `/admin/contents` | 创建草稿，返回管理详情 |
| GET | `/admin/contents/{id}` | 管理详情、version、全部扩展与图库 |
| PUT | `/admin/contents/{id}` | 完整保存可编辑内容及 version |
| POST | `/admin/contents/{id}/status` | `{status,version}`，显式发布/下线/归档/恢复 |
| DELETE | `/admin/contents/{id}?version=3` | 永久删除 draft/archived；已发布返回 409 |
| GET / POST | `/admin/categories` | 查询/创建分类，支持 kind |
| PUT / DELETE | `/admin/categories/{id}` | 修改名称/slug/sort_order 或删除未引用分类；写入需 version |
| GET / POST | `/admin/tags` | 查询/创建标签，支持 kind |
| PUT / DELETE | `/admin/tags/{id}` | 修改名称/slug 或删除未引用标签；写入需 version |
| GET | `/admin/media` | 分页媒体列表，`unused=true` 可查未引用图片 |
| POST | `/admin/media` | multipart 上传一张图片，返回 201 媒体对象 |
| DELETE | `/admin/media/{id}` | 仅删除无引用媒体；媒体不可编辑，删除无需 version |

后台内容列表默认 page_size=20，上限 50；`sort` 仅允许 `updated_desc`（默认）、`created_desc`、`sort_asc`。分类/标签默认 name 升序，支持 page/page_size，默认 50、上限 100。媒体支持 page/page_size（20/50）与 unused；默认 created_at 倒序。除这些参数外不接受任意排序/过滤。

分类创建字段为 `{kind,name,slug,sort_order}`，标签创建为 `{kind,name,slug}`；更新不能改变 kind。被任何内容引用（包括草稿或归档）时禁止删除。名称最长 50 字符，slug 规则与内容一致，分类 sort_order 为整数。

profile/settings 的 PUT 必须提交所有可编辑字段和 version，空数组清空集合、null 清空可空值。缺字段或未知字段返回 422；不把遗漏字段当作删除。后台初次 GET 返回 version=1 的初始化空记录。

## 5. 内容写入结构

三类内容共用可编辑字段：`title`、`slug`（仅创建）、`excerpt`、`body_markdown`、`cover_media_id`、`category_id`、`tag_ids`、`featured`、`sort_order`、`seo_title`、`seo_description`、`gallery` 及对应的 `project`/`life`。POST 另需 kind；PUT 另需 version，不能传 kind/slug/status/published_at。

通用创建示例：

```http
POST /api/v1/admin/contents
Content-Type: application/json
X-CSRF-Token: <session-token>
```

```json
{
  "kind": "blog",
  "title": "Rust 服务的错误处理",
  "slug": "rust-error-handling",
  "excerpt": "梳理个人网站 API 的业务错误与响应设计。",
  "body_markdown": "# 错误处理\n\n正文从这里开始。",
  "cover_media_id": null,
  "category_id": null,
  "tag_ids": [],
  "featured": false,
  "sort_order": 0,
  "seo_title": null,
  "seo_description": null,
  "gallery": [],
  "project": null,
  "life": null
}
```

创建返回管理详情，初始 `status=draft, version=1, published_at=null`。PUT 使用同一组可编辑字段，去掉 kind/slug，增加 version。默认不提供 PATCH，以免字段清空、数组合并和 null 语义含糊。

| 字段 | 类型与限制 |
| --- | --- |
| title | 去除首尾空白，1–120 字符 |
| slug | 1–100，`^[a-z0-9]+(?:-[a-z0-9]+)*$`，同 kind 唯一，创建后不可改 |
| excerpt | 1–300 字符，纯文本 |
| body_markdown | 最长 200,000 字符；draft 可为空；发布 blog/project 时不能为空 |
| cover_media_id / category_id | UUID 或 null；媒体必须 ready，分类 kind 一致 |
| tag_ids | UUID 数组，最多 10 个，不重复且 kind 一致 |
| featured / sort_order | boolean / 32 位整数，越小越靠前 |
| seo_title / seo_description | null 或非空文本，最长 70 / 160 字符 |
| gallery | `[{media_id,alt,position}]`，最多 20 张、ID 不重复、position 从 0 连续递增；blog 必须为空 |
| project | kind=project 时为对象，否则 null |
| life | kind=life 时为对象，否则 null |

project 对象另包含 `started_on`（必填 YYYY-MM-DD）、`ended_on`（日期或 null，null 表示至今，非空不得早于开始日期）；卡片和详情均返回这两个字段，UI ongoing 由 ended_on 是否 null 推导。

project 对象：`tech_stack` 为最多 20 个非空字符串、每项最长 50；`project_stage` 为 `idea/building/maintained/completed`；`repository_url`、`demo_url` 为 https URL 或 null，最长 2048。

life 对象：`occurred_on` 为必填日期；`location_label` 为 null 或最多 100 字符。发布时正文与相册至少一项。相册 alt 最长 200 字符；封面、正文、相册均计入引用，不能引用 deleting 媒体。

## 6. 版本与发布示例

```json
{"status":"published","version":1}
```

向 `/admin/contents/{id}/status` 提交上述数据，成功返回 version=2 的详情。允许转换见状态机；重复提交同版本返回 409，前端需刷新状态，不能假定第一次失败。提交当前状态但版本正确也返回 `INVALID_STATE`，避免重复操作有歧义。

保存已发布内容不改变 status/published_at，但 version 增加，并即时更新公开数据。首次发布时间固定；归档恢复必须先到 draft。删除成功 204 后无法通过应用恢复，需要从备份中提取。

## 7. 个人资料与设置字段

profile PUT：`display_name`（1–80）、`headline`（0–160）、`intro`（0–300）、`stats`（experience/projects/notes 三个展示字符串，各 0–20，不作自动计数）、`bio_markdown`（最多 20,000）、`avatar_media_id`（UUID/null）、`location_label`（null/100）、`public_email`（null/254 且格式合法）、`social_links`、`skill_groups`、`experiences`、`version`。字符串长度以字符计；空字段按约定使用空串或 null。

后台 profile GET 返回上述可编辑字段，另带只读 avatar 摘要和 updated_at；bio_markdown 不允许图片。后台 settings GET 返回可编辑字段、version 和 updated_at。两者 PUT 都只提交可编辑字段与 version，不回传只读摘要或时间。

social_links：最多 10 个 `{label,url}`，label 1–40，url 为 https 或 mailto。skill_groups：最多 10 组 `{title,items}`，title 1–50，每组最多 20 项、每项 1–50。experiences：最多 30 项 `{id,title,organization,start_date,end_date,description}`；id 是客户端为新条目生成并持久保留的 UUID，同集合不可重复；title 1–100、organization 0–120，description 最长 1000。月份为 YYYY-MM（年份 0001–9999）；end_date 可 null 表示至今，否则不早于 start_date。数组顺序就是展示顺序，不按日期重新排序。经历属于完整 profile 更新，不提供单独写接口；变更后返回整体新 version。

settings PUT：`site_name`（1–80）、`site_description`（0–300）、`footer_text`（0–300）、`default_seo_title`（null/70）、`default_seo_description`（null/160）、`version`。域名、Cookie、安全策略和数据库配置只能由部署配置改变，不允许后台修改。

## 8. 媒体与系统端点

上传 FormData 字段 `file`（单张 JPEG/PNG/WebP，≤10 MiB）与 `alt`（0–200）。返回 `{data:{id,url,thumbnail_url,mime_type,byte_size,width,height,alt,created_at,reference_count}}`；byte_size 指去元数据后的保存文件大小。URL 由后端生成，客户端不能提交存储路径。reference_count 统计所有内容/头像引用，不只已发布内容。

GET 媒体按访问者权限返回图片，私有/不存在统一 404；variant 不存在返回 404，无效枚举返回 400。媒体错误沿用 JSON 错误模型，成功返回正确 MIME 和 `X-Content-Type-Options: nosniff`。不支持 SVG、GIF、视频、任意下载附件或远程 URL 抓图。

`GET /health/live`、`GET /health/ready` 不带 `/api/v1`，返回 `{"status":"ok"}` 或就绪失败时 503（失败体为 `{"status":"not_ready"}`）。生产可仅内部访问。`GET /sitemap.xml` 同样为根路径，返回 XML，仅含已发布内容；`GET /robots.txt` 由边缘静态配置输出。
