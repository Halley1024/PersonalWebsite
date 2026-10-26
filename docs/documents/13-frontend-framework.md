# 前端工程框架规划

上级文档：[开发总览](README.md)。前端交互规范见 [03 前端设计](03-frontend.md)，页面及 API 对接见 [12 UI 对接](12-ui-integration.md)。

更新日期：2026-10-26。本文以本次提供的 `app / layouts / pages / shared / assets` 目录为目标，明确后续实现边界。最初阶段只规划目录；现已按该结构完成前端第一版。实际启动、功能范围与验证边界见 [前端说明](../../frontend/README.md)。

## 1. 规划结论与规划时的代码基线

沿用现有 React + TypeScript + Vite 技术路线，公开站与后台处于一个工程，使用不同布局和路由分包。React Router 负责导航，TanStack Query 负责服务器数据，Session Context 提供登录状态与操作，React Hook Form + Zod 负责表单，样式采用 CSS Modules + CSS 变量。首期不增加 Redux 或新的领域分层。

用户提供的完整目录作为目标目录。目录表示职责划分，不要求立即为每个组件创建空文件；先在使用处实现，出现明确跨页面复用需求时再放入 shared。

| 区域 | 本次检查到的代码状态 | 后续工作 |
| --- | --- | --- |
| 工程配置 | 已有 package.json、package-lock.json、Vite/TypeScript 配置、静态资源及类型同步脚本 | 补齐启动入口后检查依赖兼容与构建 |
| 应用组装 | 已有 app/navigation.ts；尚无 main.tsx、app/App.tsx、router.tsx、providers.tsx | 完成入口、Provider、路由和异常边界 |
| 布局与公共能力 | 已有两种布局、部分基础组件、API/Query、Session、Markdown 渲染 | 按本规划核对职责与错误处理 |
| 页面 | 已有首页、关于页及其局部组件和 Hook | 补齐三类内容列表/详情、后台及错误页 |
| 表单与媒体 | 尚无规划中的 schemas、ContentEditor、MediaPicker 等完整实现 | 按开发阶段逐步补齐 |

上表记录实施前的代码基线。后续已补齐 22 个页面目录、入口、路由、公共组件、表单及 Query/mutation 层，通过类型检查与生产构建，并确认登录页可在浏览器显示。默认 8080 后端在本次预览时未监听，真实登录、上传、发布等闭环尚未验收。

## 2. 顶层目录与文件职责

```text
frontend/
├── package.json / package-lock.json
├── index.html
├── vite.config.ts / tsconfig.json
├── scripts/
│   └── sync-api.mjs             # 保留现有后端类型同步入口
├── public/                     # 原样输出的 favicon、robots 等文件
└── src/
    ├── main.tsx                # 创建 React root，引入全局样式
    ├── app/                    # 应用入口、路由、Provider、导航配置
    ├── layouts/                # PublicLayout、AdminLayout
    ├── pages/                  # public、admin、errors；目录按用户提供的页面树
    ├── shared/
    │   ├── components/         # ui、navigation、content、profile、media、feedback
    │   ├── api/                # HTTP、错误、生成类型、各业务请求函数
    │   ├── queries/            # 查询、mutation、缓存键和失效策略
    │   ├── session/            # 登录上下文、Hook、路由守卫
    │   ├── schemas/            # 跨页面复用的表单校验
    │   ├── hooks/              # 通用交互 Hook
    │   ├── utils/              # 纯函数
    │   └── styles/             # tokens、reset、global
    └── assets/                 # 参与构建的图片与字体
```

| 文件/目录 | 负责 | 边界 |
| --- | --- | --- |
| main.tsx | 挂载 App，按 reset → tokens → global 顺序引入样式 | 不取业务数据 |
| app/App.tsx | 组合 AppProviders 与 RouterProvider | 不承担页面布局或业务表单 |
| app/router.tsx | 创建单一 Data Router，定义布局、懒加载、路由错误边界 | 不直接包含完整页面 JSX 或另建一套业务缓存 |
| app/providers.tsx | 创建稳定的 QueryClient，组装 Query、Session、Toast | QueryClient 不随组件重渲染重建 |
| app/navigation.ts | 公开导航、后台菜单与选中规则 | 不作为权限检查或重复的完整路由表 |
| layouts/ | 导航、页脚、侧栏、Outlet、响应式容器 | 不承载具体编辑表单；允许读取布局需要的站点资料 |
| pages/ | 页面参数、查询组合、表单交互、页面级状态与 SEO | 页面之间不互相 import |
| shared/components/ | 跨页面复用 UI 与业务展示/编辑能力 | 不依赖 pages、layouts 或 app |
| shared/api/ | HTTP 请求与响应，保留后端 DTO 语义 | 不显示 Toast、不跳路由、不操作 QueryClient |
| shared/queries/ | 包装 API，管理请求生命周期、缓存与失效 | 不直接渲染界面或弹窗 |
| shared/schemas/ | 表单输入校验、规范化约束 | 不能替代后端最终校验；不能手改 generated.ts 来迁就表单 |
| shared/utils/ | 日期、内容、URL 等可独立调用的纯函数 | 无 React、网络请求和隐式全局状态 |

`public/` 只放可公开的静态文件；上传媒体由后端管理，不进入 public 或 assets。robots.txt 的生产输出统一交由部署配置决定，前端文件用于本地/静态预览，规则须与 Caddy 一致，详见 [08 部署](08-deployment.md)。

## 3. 依赖方向与页面内部组织

主数据流保持为：`pages → queries → api → Rust API`。页面组合 shared 组件；app 组装页面和布局；layouts 组合 shared 导航。shared 内按能力依赖，禁止通过引用 app/providers 或页面模块形成反向依赖。

Session 层调用 auth API 并借助 Query 缓存会话，向守卫和页面提供统一状态。API client 通过注入 CSRF 值和会话失效通知与 Session 协作，不反向 import SessionProvider。

每个页面入口统一为 `Page.tsx`，样式为 `Page.module.css`。按复杂度增加页面私有目录：

```text
pages/admin/contents/edit/
├── Page.tsx
├── Page.module.css
├── components/                 # 仅该页使用的按钮区、提示等
├── hooks/                      # useEditContentPage 等页面编排
└── schema.ts                   # 仅该页需要的校验，可选
```

首页 Hero、Terminal、CollectionSection 保留在 home/components；关于页独有的 ProfileOverview 保留原位。ContentEditor 被创建页和编辑页复用，放入 shared/components/content；MediaPicker 被编辑器、头像表单与媒体相关页面复用，放入 shared/components/media。

组件优先通过 props 接收数据与回调。卡片不自行请求详情；ContentEditor 接收初值、保存回调和提交状态，保存/发布编排由页面 Hook 处理。MediaPicker 可以组合媒体 Query，但不执行内容发布。跨业务副作用留在 queries 或页面编排中。

`hooks/` 只放 Hook。现有 `hooks/drafts.ts` 实际是内存状态容器，后续可迁到 `shared/session/drafts.ts`，用于同标签页重新登录前保留编辑内容；它不属于服务端缓存，也不落 localStorage。实施时已将该状态容器迁至 session/drafts.ts。

## 4. 应用启动与 Provider

启动关系为：`main.tsx → App → AppProviders → RouterProvider`。AppProviders 内按 `QueryClientProvider → SessionProvider → ToastProvider` 组装，路由守卫在 RouterProvider 内使用 Session Context。SessionProvider 不依赖路由 Hook，登录跳转由登录页面和守卫执行。

采用 Data Router，为懒加载、路由错误边界和未保存导航拦截保留统一入口。服务端数据统一使用 Query，首期不同时建立 loader 数据状态和 Query 缓存；如以后使用 loader 预取，也应复用同一 query options 和 QueryClient。

Session 区分初始化中、已登录、未登录、请求失败。网络故障不能当作未登录直接重定向；会话接口未登录返回 HTTP 200 + authenticated=false。公开页面可以在会话读取失败时继续显示公开数据，后台守卫展示错误与重试。

页面组件懒加载；后台布局及编辑器从后台路由进入时加载。公开 MarkdownRenderer 不导入 MarkdownEditor、ContentEditor、MediaPicker，避免后台依赖进入公开页面依赖链。应用级提供加载提示和未知运行错误页面。

## 5. 页面路由与布局

| 路径 | pages 下的目录 | 布局/访问 |
| --- | --- | --- |
| `/` | public/home | PublicLayout |
| `/about` | public/about | PublicLayout |
| `/posts`、`/posts/:slug` | public/posts/list、detail | PublicLayout |
| `/projects`、`/projects/:slug` | public/projects/list、detail | PublicLayout |
| `/life`、`/life/:slug` | public/life/list、detail | PublicLayout |
| `/admin/login` | admin/login | 独立页面，不经过 RequireSession |
| `/admin` | admin/dashboard | RequireSession → AdminLayout |
| `/admin/visits` | admin/visits | 同上 |
| `/admin/access-rules` | admin/access-rules | 同上 |
| `/admin/profile`、`/admin/experiences` | admin/profile、admin/experiences | 同上 |
| `/admin/contents` | admin/contents/list | 同上 |
| `/admin/contents/new?kind=blog` | admin/contents/create | 同上；kind 还支持 project/life |
| `/admin/contents/:id/edit` | admin/contents/edit | 同上 |
| `/admin/taxonomy`、`/admin/media`、`/admin/settings` | admin 下同名目录 | 同上 |
| 未知路径 | errors/not-found | 公开路径使用 PublicLayout，后台路径保留后台布局和鉴权 |
| API 返回访问拒绝 | errors/forbidden | 当前路由中展示；不额外规划必须访问的 `/403` URL |

`/admin` 是 dashboard 的 index route，不增加重复的 `/admin/dashboard`。`new` 使用固定路由，不作为内容 ID；前端路径与 API 的 `/admin/contents/{id}` 分开维护。已登录访问登录页时，先校验站内返回目标再跳转，否则回 `/admin`。

筛选参数存 URL：公开列表用 page/q/category/tag/featured，管理列表另按接口支持 kind/status/sort。切换筛选重置 page；解码、默认值和参数白名单由 useUrlFilters 与业务参数转换函数处理。不把所有 search params 原样转交后端，因为未知参数会被拒绝。

403 按错误 code 处理：ACCESS_DENIED 展示访问受限；CSRF_FAILED 提示重新获取会话后手动重试；ORIGIN_FORBIDDEN 提示请求来源配置异常。前端守卫仅控制导航体验，真实权限由后端执行。

## 6. 数据与缓存职责

`api/{business}.ts` 提供有类型的请求函数，查询接收 AbortSignal；`queries/{business}.ts` 提供 query options/Hook 与 mutation，统一使用 keys.ts 中的键。公开与管理 DTO、列表与详情必须分开缓存。

| 数据 | 缓存键约定 | 写入后的刷新范围 |
| --- | --- | --- |
| 会话 | `['session']` | 登录更新；退出清理会话及管理缓存 |
| 公开资料/设置 | `['public','profile']`、`['public','settings']` | 保存对应管理对象后失效 |
| 公开内容列表 | `['public',resource,normalizedFilters]`，resource 为 posts/projects/life | 对应 kind 内容变化后失效，包含首页使用的列表 |
| 公开详情 | `['public','content',kind,slug]` | 当前内容变化后失效 |
| 管理列表/详情 | `['admin','contents',filters]`、`['admin','content',id]` | 保存、状态切换、删除后更新详情并失效列表与 dashboard |
| 资料/设置 | `['admin','profile']`、`['admin','settings']` | 使用成功响应更新缓存，以新 version 为准 |
| 分类/标签 | `['public','taxonomy',type,kind]`、`['admin','taxonomy',type,filters]` | 目录变更后刷新相应目录及受影响内容 |
| 媒体 | `['admin','media',filters]` | 上传/删除及内容或头像引用变更后失效 |
| 流量/访问/规则/区域 | `['admin',resource,filters]` | 规则写入刷新规则；历史统计不伪造为即时改变 |

上表为缓存规范，实施时已在 keys.ts 集中维护查询键。第一版 mutation 沿用 invalidate.ts 的较宽刷新范围，后续可按实际需要收窄。

表单状态由 React Hook Form 持有；弹窗、预览开关由局部 state 持有；筛选由 URL 持有；服务端对象由 Query 持有；登录身份由 Session 暴露。不要把同一内容详情再复制到全局 store。表单从服务器建立编辑快照后，窗口聚焦引起的后台刷新不得覆盖用户未保存输入。

公开 GET 对临时网络/5xx 最多重试一次，确定的业务错误不重试。mutation 不自动重试。退出或会话失效时取消管理查询并清理私有缓存；非主动过期可以保留当前内存编辑快照，主动退出和修改密码成功则清理草稿、CSRF 和会话状态。

## 7. 接口类型、表单与错误

类型链路沿用当前脚本：`backend/scripts/generate_openapi.py → backend/openapi.json + backend/docs/api-types.ts → frontend/scripts/sync-api.mjs → shared/api/generated.ts`。这是从后端同一契约源生成并复制类型，当前不是直接读取 OpenAPI 的前端代码生成器。generated.ts 只生成，不手改。

表单类型可以包含界面专用字段，例如 ongoing、待上传 File、标签选择项；提交前显式构造 CreateContent/UpdateContent 等请求对象。禁止直接展开整个 GET 响应提交 PUT，否则会混入 slug、status、时间及只读摘要。输入校验不代表运行时响应已得到 Zod 校验。

`api/errors.ts` 统一保留 status/code/message/fields/request_id。422 映射到字段，409 按 VERSION_CONFLICT、SLUG_CONFLICT、RESOURCE_IN_USE、INVALID_STATE 分别提示；只有版本冲突进入 ConflictDialog，不能把所有 409 都当作覆盖冲突。5xx 与未知错误提供重试及 request_id；204 不解析 JSON，上传不手工指定 multipart boundary。

## 8. 关键业务流程

### 8.1 内容创建、保存与发布

创建页由 URL kind 初始化固定内容类型；新建时提交 kind 和 slug，创建成功后进入编辑路由并采用返回的 version。编辑时 kind/slug 只读。

ContentEditor 组合基本信息、MarkdownEditor、分类标签、封面与 GalleryEditor；项目和生活专用字段放在编辑器内部子组件中。表单 schemas 区分可保存草稿与发布条件，避免把发布必填校验强加给空正文草稿。

发布动作顺序为：校验 → 如有修改先保存 → 取得服务器新 version → 请求 status=published → 更新详情与列表。已发布内容保存立即更新公开站，页面明确提示。保存成功而发布失败时显示两步的真实状态，保留服务器返回的草稿版本；发布结果不明先重新读取，不盲目重发。

版本冲突保留本地输入，允许复制和重新加载。UnsavedChangesGuard 负责站内导航与 beforeunload；确认离开后才丢弃对应快照。更换编辑对象时按内容 ID 隔离表单，不能将上一条内容的输入带到新对象。

### 8.2 个人资料与经历

两页共享 `['admin','profile']`，经历编辑只是完整 profile 的一个编辑视图，没有独立 experiences API。每次保存提交完整可编辑 profile 和编辑快照对应的 version，不能只发送 experiences，也不能把旧草稿和最新 version 拼接绕过冲突。

经历日期保持 YYYY-MM，项目和生活日期保持 YYYY-MM-DD；不经过 UTC Date 转换而引入月份/日期偏移。经历新条目使用稳定 UUID，数组顺序即展示顺序。

### 8.3 媒体与 Markdown

ImageUploader 负责文件选择及上传交互，MediaPicker 负责选择媒体，GalleryEditor 负责内容中的排序及 alt。上传先得到媒体 UUID，再保存内容引用；封面替代文本遵循现有不可编辑媒体契约，不增加不存在的媒体更新 API。

MarkdownEditor 采用 textarea + 预览；MarkdownRenderer 用于后台与公开详情。两者通过 `media:UUID` 关联图片，渲染器对图片来源和链接协议统一校验，禁止原生 HTML/MDX。用户媒体不写入前端仓库。

### 8.4 流量与访问规则

usePageview 挂在公开布局内，在首屏和每次成功公开路由切换后上报，忽略后台；page_path 移除查询串和 hash，同一导航的重渲染不重复上报。事件去重与路径口径遵循 [11](11-analytics-and-access-control.md)。展示数据只来自真实 API，未接通时显示空状态或错误状态。

dashboard 组合 analytics 和内容计数接口；visits 负责记录筛选与分页；access-rules 负责规则列表和写入。封锁成功才更新规则显示；解除 IP 后仍可能命中区域规则，历史访问统计不因解除规则而清空。

## 9. 样式、资源与公共组件

沿用原型信息结构和设计变量，tokens.css 统一颜色、间距、字号、圆角、层级与断点约定，global.css 只放全局基础样式。组件与页面视觉通过相邻 module.css 管理，避免页面选择器影响其他模块。

现有 Badge、Panel、Field、ErrorNotice、PageHeading 可以保留，不为匹配目录示例删除。Input/Textarea/Select 只有在 label、错误、禁用态及焦点行为确有统一需求时补齐；不要一次性建立无人使用的组件库。

各页面覆盖 loading/error/empty/ready，表单补充 submitting/dirty/conflict。弹窗统一管理焦点和 Escape，按钮支持键盘，动画尊重 prefers-reduced-motion。公开卡片共享展示能力但保留博客、作品、生活不同信息，不用过量布尔 props 做成一个万能组件。

测试随被测组件或函数放置 `*.test.ts(x)`；如保留当前 Vite 配置中的 setupFiles，应补齐 `src/test/setup.ts`。若引入 Lint，再增加实际配置和 npm 脚本，当前 package.json 尚无 lint 命令。

## 10. 实施顺序与完成标准

| 阶段 | 工作 | 可验收结果 |
| --- | --- | --- |
| 1 工程闭环 | 启动入口、Provider、路由、错误页、现有两页接入、测试初始化 | 能启动及构建，深链接刷新可访问，未知路由显示 404 |
| 2 公开阅读 | 三类列表/详情、URL 筛选、Markdown、SEO、统计上报 | 使用真实 API；空数据、失败、404/403 分别展示 |
| 3 登录与基础管理 | 登录/退出、守卫、profile/experiences/settings | 会话与 CSRF 正常，资料完整 PUT，过期和 409 不丢输入 |
| 4 内容闭环 | 分类标签、媒体、ContentEditor、创建/编辑/发布 | 上传→草稿→发布→匿名访问→下线完整可验证 |
| 5 管理统计与收口 | dashboard/visits/access-rules、响应式、可访问性、部署代理 | 使用真实统计和规则，生产深链接和同源请求验收通过 |

按用户要求，第一版不新增或运行测试；当前以类型检查、生产构建和页面预览作为基础检查。已有测试依赖保留，后续决定开展测试时再补齐初始化和用例。后文自动化场景为后续建议，不是第一版已完成事项。

有针对性的自动化用例覆盖请求 204/错误解析、Markdown 危险协议、会话状态、版本冲突、保存后发布的版本衔接。真实浏览器联调检查登录、上传、冲突、未保存跳转与 360/768/1440px 布局；构建通过不等于上述交互已验收。

阶段 1 的工程入口与后续各功能页面现已实现；类型检查和构建已通过，真实后端闭环、全尺寸视觉检查与部署仍待验收。
