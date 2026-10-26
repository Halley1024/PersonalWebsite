# PersonalWebsite

一个用于展示个人介绍、技术笔记、项目作品和生活记录的个人网站，配套单管理员内容管理后台。前端使用 React + TypeScript，后端使用 Rust + Axum，业务数据保存在 PostgreSQL，图片由后端独立管理。

目前已实现前后端功能接入，支持本地运行。**Docker 部署尚未完成，仓库暂未提供 Dockerfile、Compose 和 Caddy 配置，也没有经过生产部署验收。**

## 项目功能

### 公开站

- 首页：个人介绍、终端展示、精选作品、最近笔记与生活记录。
- 关于：完整介绍、技能分组、经历时间线及公开联系方式。
- 博客：笔记卡片、关键词搜索、标签筛选、分页与 Markdown 详情。
- 作品与生活：独立列表和详情，展示项目资料、发生日期及图片相册。
- 外观：深色 / 浅色主题切换、公开页粒子背景及响应式布局。

### 管理后台

- 账号：管理员登录、退出和密码修改。
- 个人资料：介绍、头像、技能、社交链接与经历排序。
- 内容：创建草稿、编辑、预览、发布、下线、归档、恢复和删除。
- 分类标签与媒体：维护分类和标签，上传、选择和删除未引用图片。
- 访问分析：流量总览、访问记录，以及 IP / 区域封锁规则。
- 站点设置：站点名称、介绍、页脚文字与默认 SEO 信息。

内容保存和发布是两个独立操作；已发布内容保存后会更新公开版本。后台更新使用 `version` 检查并发冲突，登录使用服务器 Session，不把登录令牌保存在 localStorage。主题偏好可在本地保存。

区域识别依赖服务端配置的本地数据源；未配置时显示未知区域，不能创建有效的区域封锁规则。生产环境对静态页面的封锁还需要反向代理配合，不能只依靠前端页面判断。

## 技术栈与目录

| 部分 | 技术 |
| --- | --- |
| 前端 | React、TypeScript、Vite、React Router、TanStack Query |
| 表单与内容 | React Hook Form、Zod、Markdown、CSS Modules |
| 后端 | Rust、Axum、Tokio、SQLx |
| 数据与文件 | PostgreSQL、Markdown 原文、私有媒体目录 |
| 目标部署方式 | Linux + Caddy + Docker Compose，尚待落地 |

```text
PersonalWebsite/
├── frontend/
│   ├── src/app/              # 应用入口、路由、Provider
│   ├── src/layouts/          # 公开站与后台布局
│   ├── src/pages/            # 每个页面独立目录，包含 TSX 与 CSS
│   ├── src/shared/           # 公共组件、API、Query、会话、主题等
│   └── public/               # 公开静态资源
├── backend/
│   ├── src/modules/          # 按业务划分的 handler/service/repository 等
│   ├── src/routes/           # 接口路由
│   ├── src/middleware/       # 鉴权、CSRF、访问控制等
│   ├── src/bin/              # 迁移与管理命令
│   ├── migrations/           # SQL 迁移
│   └── openapi.json          # 接口契约
└── docs/documents/           # 架构、接口、数据与运维设计
```

## 本地启动

以下命令使用 Bash，并假定当前位于项目根目录。

### 1. 准备环境

- Rust / Cargo：使用支持 Rust 2024 edition 及当前锁定依赖的工具链。
- Node.js：当前前端依赖要求 `^20.19.0 || >=22.12.0`；使用 npm 安装依赖。
- PostgreSQL：准备一个已存在、可连接的数据库，以及有迁移建表权限的数据库账号。
- 为图片准备可写目录。

数据库可以来自已有容器或本机服务；项目本身目前不负责通过 Compose 启动数据库。

### 2. 初始化并启动后端

在终端一执行：

```bash
cd backend

read -rsp '请输入数据库连接串：' DATABASE_URL
echo
export DATABASE_URL
export APP_ENV=development
export BIND_ADDR=127.0.0.1:8080
export PUBLIC_ORIGIN=http://localhost:5173
export MEDIA_ROOT="$PWD/data/media"

cargo run --locked --bin migrate
cargo run --locked --bin admin-create
cargo run --locked --bin backend
```

连接串格式为 `postgres://用户名:经过URL编码的密码@127.0.0.1:5432/数据库名`。迁移命令创建和更新表结构，不创建数据库。`admin-create` 通过交互输入创建唯一管理员，没有默认账号密码；已有管理员时跳过这一步。

后端读取进程环境变量，**不会自动加载 `.env` 文件**。配置示例见 [backend/.env.example](backend/.env.example)，上述命令需要在同一个终端中执行。

### 3. 启动前端

在项目根目录另开终端二：

```bash
cd frontend
npm ci
npm run dev
```

- 网站首页：[http://localhost:5173](http://localhost:5173)。
- 后台登录：[http://localhost:5173/admin/login](http://localhost:5173/admin/login)。
- 后端服务：`http://127.0.0.1:8080`，前端通过 Vite 同源代理访问 `/api/v1`。

浏览器地址必须与后端 `PUBLIC_ORIGIN` 一致。`localhost` 和 `127.0.0.1` 是不同 Origin，混用会导致登录或写请求被拒绝。

如需修改后端代理地址，将 [frontend/.env.example](frontend/.env.example) 复制为 `frontend/.env.local`，调整 `API_PROXY_TARGET` 后重启 Vite；同时修改后端对应的监听配置。

### 4. 检查启动情况

```bash
curl --noproxy '*' -i http://127.0.0.1:8080/health/live
curl --noproxy '*' -i http://127.0.0.1:8080/health/ready
```

`live` 检查服务存活，`ready` 进一步检查数据库和迁移状态。首次启动后可登录后台填写个人资料、创建内容并发布，公开站会从接口读取数据。

## 构建与部署

### 构建发布产物

在项目根目录执行：

```bash
cd frontend
npm ci
npm run build

cd ../backend
cargo build --locked --release --bins
```

前端产物位于 `frontend/dist/`。后端产物位于 `backend/target/release/`，包括 `backend`、`migrate`、`admin-create`、`admin-reset-password`、`access-rule-disable` 和 `maintenance`。

前端 build 会先从 `backend/docs/api-types.ts` 同步接口类型，因此构建时需要保留前后端相邻的项目目录。后端迁移程序在运行时读取 SQL，部署时还需一并提供 `backend/migrations/`。

### 生产运行需要的配置

| 配置 | 用途 |
| --- | --- |
| `APP_ENV=production` | 启用生产 Cookie 与配置要求 |
| `PUBLIC_ORIGIN=https://你的域名` | 与浏览器访问地址完全一致，不含路径和末尾斜杠 |
| `DATABASE_URL_FILE` | 保存数据库连接串的受限文件路径 |
| `VISITOR_HMAC_KEY_FILE` | 至少 32 字节的二进制访客统计密钥文件路径 |
| `MEDIA_ROOT` | 可写、持久化的私有媒体目录 |
| `MIGRATIONS_DIR` | 随发布包提供的 SQL 迁移目录，使用绝对路径 |
| `BIND_ADDR` | 后端监听地址，根据宿主机或容器网络设置 |
| `TRUSTED_PROXIES` | 实际反向代理的地址段，仅在使用代理时配置 |
| `GEOIP_FILE` | 可选的本地区域数据源 |

生产模式要求通过文件提供数据库连接串和访客密钥。详细约束见 [后端说明](backend/README.md)。

### 部署流程（待落地与验收）

1. 准备 Linux 服务器、域名、PostgreSQL、媒体目录和生产配置文件。
2. 构建并放置前端 dist、后端二进制和 migrations，设置目录权限。
3. 在生产配置下先执行 `migrate`，首次部署时再交互执行 `admin-create`。
4. 启动后端，并由进程管理器或后续容器配置负责重启、日志与环境变量。
5. 配置 Caddy 等反向代理：提供 HTTPS 和前端静态文件，将 `/api/*`、`/sitemap.xml` 转发至后端。
6. 为公开站和后台的深链接提供 SPA 回退；`/api/*`、不存在的构建资源不能回退成 HTML。业务图片必须经过后端读取，不能直接公开媒体目录。
7. 接入公开页面的访问规则检查，验证真实客户端 IP；健康检查和 `/internal/*` 保持内部访问。
8. 验证登录、资料保存、图片上传、发布和下线，并完成数据库与媒体的配套备份、恢复演练。

目前这些步骤是部署实施说明，不代表已有可直接执行的一键发布流程。Vite 的 `dev` 和 `preview` 用于开发或预览，不作为生产服务器。

后续 Docker 部署计划采用 `web / backend / db` 服务划分，为数据库、媒体和 HTTPS 证书提供持久化存储。镜像构建、Compose 配置和代理配置仍需补齐，具体方案见 [部署与运维设计](docs/documents/08-deployment.md)。

## 文档与许可证

- [前端说明](frontend/README.md)：前端启动、目录、主题与构建。
- [后端说明](backend/README.md)：后端配置、业务模块与管理命令。
- [开发文档总览](docs/documents/README.md)：架构、HTTP 契约、数据存储和实施规划。
- [OpenAPI](backend/openapi.json)：接口定义。
- [LICENSE](LICENSE)：项目许可证。
