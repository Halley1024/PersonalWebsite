# React 前端设计

上级文档：[开发总览](README.md)。路由全表见 [需求与页面](01-requirements-and-pages.md)。目录、依赖边界、Provider 与实施顺序见 [13 前端框架规划](13-frontend-framework.md)。

## 1. 工程与依赖职责

React + TypeScript + Vite 构建单一前端工程。React Router 管路由，TanStack Query 管服务端数据；局部界面状态使用 `useState`，会话通过 Context 共享，不为首期引入 Redux。React Hook Form 管理复杂表单，Zod 提供客户端校验；最终仍以后端校验结果为准。

样式采用 CSS Modules 和统一 CSS 变量。由原型提取颜色、字体、间距、圆角及动效，拆为导航、按钮、卡片、时间线等组件。原型中的注入脚本、`data-page-node-id` 和平台辅助标记不进入应用；示例内容不写死在页面中。

## 2. 路由与布局

公开路由挂载 `PublicLayout`，包含导航、页脚、移动菜单。后台挂载 `AdminLayout`，包含侧栏、编辑区和登录状态；登录页独立。后台模块使用动态导入，公开访问不加载编辑器。

进入后台先查询 `/auth/session`；未登录跳转登录页，登录成功后返回安全的站内目标路径。禁止把外部 URL 作为登录跳转目标。API 返回 401 时清空本地会话状态并保留未保存的内存表单，不默认把草稿存入 localStorage。

生产代理为公开页面和后台深链接提供 `index.html` 回退；`/api/*` 不回退到 HTML。前端未知路径展示自己的 404 页面。

## 3. 请求封装与缓存

统一 `apiClient` 使用相对地址 `/api/v1`，JSON 请求设置正确 Content-Type，携带同源 Cookie。写请求从当前会话读取 `X-CSRF-Token`；文件上传用 FormData，交由浏览器设置 multipart boundary。

接口错误转换为包含 `status`、`code`、`message`、`fields`、`request_id` 的前端错误。保存请求不自动重试，避免结果不明时重复创建；网络失败先提示重新获取状态。公开 GET 对临时网络/5xx 错误最多重试一次，401/403/404/422 不重试。

| Query key | 失效时机 |
| --- | --- |
| `['public','profile']` | 个人资料保存后 |
| `['public','settings']` | 站点设置保存后 |
| `['public','posts', filters]` / `projects` / `life` | 对应内容保存、发布、下线或删除后 |
| `['public','content', kind, slug]` | 当前内容变化后 |
| `['admin','contents', filters]`、`['admin','content', id]` | 内容变更后 |
| `['admin','media', filters]` | 上传或删除媒体后 |
| `['taxonomy', kind]` | 分类标签变更后 |

列表筛选同步到 URL search params，切换筛选重置页码。公开页查询 staleTime 首期设为 0，详情进入与窗口重新聚焦时刷新；后台状态变更后主动 invalidate。其他访客已打开的页面不会收到推送，切页或重新聚焦后才刷新，这是首期行为。

## 4. 表单与编辑器

共用 `ContentEditor` 展示标题、slug、摘要、正文、封面、标签、状态和 SEO；按 kind 加载作品或生活字段。kind 创建后不可改，slug 由输入或标题生成候选值，保存创建后只读。中文标题可手填简短英文 slug，不使用不可维护的自动音译依赖。

表单展示字段长度、必填和错误。保存始终提交完整可编辑字段及读取时的 `version`；不提交状态、发布时间、作者等服务端字段。409 时弹出冲突提示，可复制当前文本、重新加载服务器版本；绝不自动覆盖。

Markdown 首期采用 textarea + 分栏预览，支持 GFM、代码高亮、目录与本地图片插入。统一禁止原生 HTML、MDX、脚本及危险链接协议；链接需验证协议，外链新窗口设置 `rel="noopener noreferrer"`。可选代码高亮不执行代码。

图片插入源文为 `![替代文本](media:UUID)`，渲染时转换为 `/api/v1/media/UUID`。只支持媒体库图片，外链图片首期不提供；普通 https 超链接正常保留。上传成功并不等于已保存到文章，离开时应提示仍有未关联媒体。

## 5. 关键组件

| 组件 | 责任 |
| --- | --- |
| `ProfileHero` / `ExperienceTimeline` | 渲染后台配置的个人介绍 |
| `ContentCard` / `ProjectCard` / `LifeCard` | 根据页面类型展示摘要与状态无关的公开信息 |
| `MarkdownRenderer` | 正文、代码块、图片、目录；后台与公开站共用 |
| `MediaPicker` / `GalleryEditor` | 媒体选择、替代文本、拖动或按钮排序 |
| `QueryState` | loading/error/empty/ready 四种状态 |
| `ConfirmDialog` | 删除、下线、归档与公开更新确认 |
| `UnsavedChangesGuard` | 导航与关闭页面前提醒 |
| `Pagination` / `FilterBar` | 可复制的分页和筛选 URL |

## 6. 响应式、可访问性与性能

布局优先使用 CSS Grid/Flex；窄屏侧栏变抽屉，表格可横向滚动，编辑器预览可切换。长代码块局部滚动，不撑破页面；长标题和 URL 可折行。所有图片预留宽高，首屏头像可优先加载，其余懒加载。

交互按钮有可见焦点，菜单与弹窗支持 Escape 关闭、焦点管理和键盘操作。表单 label 关联输入，异步保存反馈使用可访问的状态提示。支持 `prefers-reduced-motion`，背景动画不得阻塞阅读。

部署时前端使用本地字体或系统字体栈，避免把原型对 Google Fonts 的依赖作为必须条件。构建产物使用哈希文件名，页面入口不长期缓存。

## 7. SEO 与公开信息

每个公开页面设置 title、description、canonical；标题来源为内容 `seo_title` 或标题，描述来源为 `seo_description` 或摘要。列表筛选页面 canonical 指向基础列表；详情 canonical 使用固定 slug。后台设置 `noindex`，同时在 robots 中禁止抓取，但权限仍由后端控制。

Rust 提供 `/sitemap.xml`，包含公开主页、列表与已发布详情；Caddy 输出 `/robots.txt`。首期 SPA 无法保证社交机器人读取动态 meta 或搜索引擎正确处理应用级 404，若这些成为上线必需条件，应先完成 SSR 升级，见 [架构取舍](02-architecture.md)。

## 8. 当前 UI 的迁移与新增页面

保持原型公开站分区、后台流量面板、内容编辑、个人介绍及经历时间线的信息结构；路由和字段映射见 [12 UI 对接](12-ui-integration.md)。原型 works 映射为 API project，summary/body 映射 excerpt/body_markdown，不直接把本地对象作为请求体。

个人介绍补充 intro、stats；经历表单使用 start_date/end_date，不转换成伪造日精度。个人介绍和经历共享 profile.version，经历每次保存/排序都需发送最新完整 profile；409 保留表单并提示重新加载，不覆盖其他页签。

增加流量、访问明细和访问规则页面及对应 API/Query 模块，读取 [11](11-analytics-and-access-control.md) 接口。统计图使用服务器返回值；未启用或无数据时显示明确空状态，平均停留时间暂为 null。封锁按钮必须在 API 写入成功后显示生效，解除单 IP 不代表区域规则已解除。路由切换后发送一次 pageview，组件重复渲染不重复上报；不得从浏览器提交 IP 或区域。

## 9. 前端验证

第一版按当前用户要求不新增或运行测试，执行 TypeScript 检查和生产 build；当前尚未引入 Lint。后续联调与质量检查建议如下。用浏览器验证首页、三类详情、登录、编辑、上传和 409 冲突流程；分别检查 360px、768px、1440px。对 Markdown 危险协议、HTML 与超宽代码块设置有针对性的渲染测试。
