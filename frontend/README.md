# PersonalWebsite 前端

React + TypeScript + Vite。公开站和管理后台共用工程，UI 参考 `../docs/pages/` 中的静态 mock；正式页面从 Rust API 读取和保存数据。

## 启动

当前依赖要求 Node.js `^20.19.0 || >=22.12.0`；本次构建使用 Node.js 24.21.0。

```bash
cd /home/halley/Projects/PersonalWebsite/frontend
npm ci
npm run dev
```

打开 http://localhost:5173，后台登录页为 http://localhost:5173/admin/login。

开发代理默认连接 `http://127.0.0.1:8080`。后端启动与数据库初始化见 [后端说明](../backend/README.md)。后端 `PUBLIC_ORIGIN` 应为 `http://localhost:5173`；localhost 与 127.0.0.1 是不同 Origin，不能混用，否则登录和写请求会被拒绝。

如后端端口不同，可复制 `.env.example` 为 `.env.local` 修改 `API_PROXY_TARGET`，然后重启 Vite。生产使用同源 `/api/v1` 反向代理，前端不保存数据库凭据或 Session token。

## 目录

- `src/app/`：App、路由、Provider、导航配置。
- `src/layouts/`：公开站与后台布局。
- `src/pages/`：按页面功能划分，每页包含 Page.tsx 和 Page.module.css。
- `src/shared/components/`：跨页面使用的 UI、内容编辑、资料、媒体与反馈组件。
- `src/shared/api/`：业务请求、错误解析及生成的 DTO。
- `src/shared/queries/`：Query 与 mutation，统一缓存键和更新后的失效处理。
- `src/shared/session/`：会话上下文、守卫与当前标签页的内存编辑快照。
- `src/shared/schemas/`：复用的表单校验。
- `src/shared/hooks/`、`utils/`、`styles/`：通用交互、纯函数与全局样式。
- `src/assets/`：参与构建的图片与字体；用户上传图片由后端保存。

页面独有组件留在页面目录；页面之间不互相引用。共享组件不反向依赖 app 或 pages；导航配置由路由组装层传给布局和导航组件。完整规划见 [前端框架](../docs/documents/13-frontend-framework.md)。

## 第一版范围

公开站：首页、关于、博客/作品/生活的列表和详情、筛选分页、Markdown、联系弹窗、错误状态与页面事件上报。

后台：登录/退出、流量总览、访问记录、IP/区域规则、资料/经历、内容创建/编辑/发布/下线/归档/删除、分类标签、媒体上传与选择、站点设置及密码修改。

内容和资料更新带 version；版本冲突保留输入并允许重新加载。创建与发布分两步执行；图片上传后需要保存内容引用。编辑快照仅存在当前标签页内存，刷新会丢失，不把草稿或登录令牌写入 localStorage。

## 类型与构建

```bash
npm run sync:api
npm run typecheck
npm run build
```

build 会先同步后端类型、检查 TypeScript，再生成 dist。generated.ts 从 `../backend/docs/api-types.ts` 复制，不能手工维护；后端契约变化后先在后端运行 `python3 scripts/generate_openapi.py`。

第一版不新增或运行测试。已有测试依赖暂时保留；当前未建立测试用例和测试初始化配置。

本次已通过类型检查和生产构建，并在浏览器确认登录页可显示。本次预览时默认 8080 后端未监听，尚未验证真实登录、上传、发布、数据库写入和全部页面响应式效果；代码接入 API 不代表端到端联调已通过。

生产需由 Caddy 等代理提供 SPA 深链接回退；`/api/*` 不回退 HTML。Vite preview 的端口默认 4173，写请求联调时需同步后端 PUBLIC_ORIGIN；preview 不作为生产服务器。

## 深浅主题

默认保留深色，公开站、登录页和后台顶栏均可切换主题，刷新后保留选择。

配色分别位于 `src/shared/styles/themes/dark.css` 和 `light.css`；公共字体及尺寸仍在 `tokens.css`。组件只引用主题变量，主题状态放在 `shared/theme/`，切换按钮放在 `shared/components/ui/theme-toggle/`。详见 [主题样式说明](src/shared/styles/themes/README.md)。

主题改动已通过生产构建，并在浏览器确认浅色首页、登录页及刷新后的偏好恢复；未新增或运行测试。
