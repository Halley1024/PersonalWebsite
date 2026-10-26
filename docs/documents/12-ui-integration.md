# 当前 UI 与正式工程对接

上级文档：[开发总览](README.md)。依据 2026-10-25 仓库静态原型编写。本文保留视觉和操作结构，说明数据替换点；不表示 React 联调已完成；截至 2026-10-26 已有部分 React 工程文件，当前状态与后续框架见 [13 前端框架规划](13-frontend-framework.md)。

## 1. 页面及接口映射

| 原型入口 | 正式路由 | 数据与接口（/api/v1 前缀省略） |
| --- | --- | --- |
| index.html#home | / | profile/settings、精选 projects、最近 posts/life；可并行读取 |
| index.html#about、联系弹窗 | /about、共用联系弹窗 | GET profile；public_email/social_links；不需要留言提交接口 |
| index.html#blog | /posts | GET posts/tags/categories，分页和筛选同步 URL |
| index.html#works、作品时间线 | /projects | GET projects；started_on/ended_on 展示项目周期 |
| index.html#life | /life | GET life；occurred_on 表示发生日期 |
| article.html?type=blog/works/life&id=… | /posts/:slug、/projects/:slug、/life/:slug | 各自 GET 公开详情；原型 id 不能当数据库 UUID |
| login.html | /admin/login | POST auth/login、GET auth/session；密码不本地保存 |
| admin.html#dashboard | /admin | GET admin/analytics?days=7 或 30；内容计数另取 admin/dashboard |
| 后台访问明细面板 | /admin/visits | GET admin/visits；日期/来源/区域/关键词/分页 |
| 后台封锁规则面板 | /admin/access-rules | admin/access-rules CRUD、admin/regions |
| admin.html#contents/all、blog、works、life | /admin/contents?kind=… | GET admin/contents；all 时省略 kind；works 转 project |
| 内容编辑/预览 | /admin/contents/new、/:id/edit | admin/contents、admin/media、status；详情见 05 |
| 个人介绍面板 | /admin/profile | GET/PUT admin/profile，含 intro/stats/技能 |
| 经历时间线面板 | /admin/experiences | GET/PUT admin/profile.experiences；共用整体 version |
| 尚无独立完整原型的支撑页 | /admin/taxonomy、/admin/media、/admin/settings | 既有设计能力；沿用后台样式实现最小可用表单 |

当前访问明细与封锁规则是 dashboard 中的内嵌面板，正式路由为逻辑拆分，不要求改变现有视觉布局。index.html 当前以行内脚本实现分区与分页，script.js 属于较早原型且未被当前首页引用，不直接迁移其中的下载示例。

当前博客每页 6 项、作品 9 项的布局可通过 page_size 明确请求；API 默认 12 不强迫界面改变卡片数量。首页合集数量仍以 01 的首页规则为准。原型哈希入口与正式 history 路由不同，部署须支持深链接刷新。

## 2. 原型字段转换

| 原型数据 | 正式 DTO/存储 | 转换规则 |
| --- | --- | --- |
| kind=works | kind=project | UI 中文仍为作品；服务端不接受 works |
| summary、body | excerpt、body_markdown | Markdown 原文传输，不存渲染 HTML |
| tags 名称数组 | tag_ids / tags 摘要 | 管理页先按 kind 查询标签目录；新标签经 POST 创建后取 UUID；不把名称当 ID |
| stage、tech、repository | project.project_stage/tech_stack/repository_url | 合法 https；空 URL 转 null |
| startedOn、endedOn、ongoing | project.started_on/ended_on | 项目日期为 YYYY-MM-DD；ongoing=true 时 ended_on=null |
| occurredOn、location | life.occurred_on/location_label | 生活独立发生日期；空地点转 null |
| coverImage（data URL）、coverBackground | cover_media_id | File 先上传，取 UUID；演示渐变不入库；空封面用前端默认样式 |
| coverAlt | media.alt | 首期封面替代文本在上传时写入媒体；替换描述需重新上传并换封面；不虚构未定义的 alt 更新接口 |
| createdAt、updatedAt | created_at、updated_at | 时间由服务器生成，不接受原型提交 |
| views、analytics、visitorEvents | analytics/visits API | 丢弃脚本生成数值，禁止预填生产流量 |
| profile.name/intro/bio/skills | display_name/intro/bio_markdown/skill_groups | profile.stats 保留展示字符串；依 05 校验 |
| experiences.startedOn/endedOn | start_date/end_date | YYYY-MM 原样保留；null 表示至今；新 UUID 替换示例 ID |
| access createdAt/expiresAt/targetLabel | created_at/expires_at/target_label | 创建传 duration_hours，目标 IP/region_id；时间和标签由服务端生成 |

## 3. localStorage 与正式持久化

| 当前 key | 用途 | 正式替换 |
| --- | --- | --- |
| halley.admin.content.v1 | 当前浏览器内容数组 | 内容及媒体 API |
| halley.admin.about.v1 | 资料与经历 | profile API |
| halley.admin.access-rules.v1 | 本地登记规则 | access-rules API + 服务端执行 |

这些数据当前不会同步到公开站内置 ARTICLE_CONTENT，也不会跨浏览器同步。正式应用不自动读取并迁移这些 key，避免示例内容进入数据库。若需保留真实草稿，另做人工确认导出/导入，重新上传图片、生成 UUID 并从 draft 开始，不沿用假发布状态和浏览量。

会话令牌禁止放 localStorage。前端请求缓存仅用于 UI；服务器响应成功后才显示“已保存/已生效”，失败保留表单。跨标签页使用 version 避免互相覆盖。正式返回登录页按钮需调用 auth/logout 撤销会话，原型跳转不能替代退出。

## 4. 交互闭环

- 发布按钮：若表单有修改先保存草稿/当前内容，取得新 version，再调 status；已发布内容只保存，不重复发布；第二步失败保留“已保存草稿、发布失败”的准确状态。
- 图片：上传成功后仍需保存内容引用；未引用媒体对公众不可见。首期封面 alt 复用媒体 alt，图库 alt 可按内容覆盖。
- 经历：本地即时预览；保存/移动/删除等待 profile API 成功后刷新当前版本；撤销是新一次写入。
- 封锁：先确认范围和有效期，API 成功后更新列表；提示解除 IP 仍可能命中区域规则；不能只把本地徽标改成“封锁”。
- 页面异常：分别处理 loading、empty、403、404、409、5xx；无统计数据不得回退原型曲线；禁用未接入的 RSS 等占位入口。

## 5. 对接完成标准

在一个浏览器保存真实资料和草稿，另一浏览器能通过服务端读取；发布后匿名详情可见，下线后内容及私有图片不可见；页面、接口、数据库中 kind 和日期含义一致；所有 UI 示例流量退出正式数据路径。逐项验收见 [09](09-implementation-and-testing.md)。
