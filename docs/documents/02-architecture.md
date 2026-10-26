# 技术路线与系统架构

上级文档：[开发总览](README.md)。本项目采用前后端分离开发、同源部署的模块化单体架构。

## 1. 选型与替代方案

| 领域 | 选择及原因 | 暂不采用的方案与触发条件 |
| --- | --- | --- |
| React 工程 | Vite + TypeScript，便于学习和与 Rust API 对接 | 首期不加 Next.js 服务；需要可靠分享卡片或搜索收录时评估 SSR |
| UI | CSS Modules + CSS 变量，沿用原型设计 | 不同时引入多套大型组件库；后台复杂后可单独引入一套 |
| 后端 | Axum + Tokio，与 Rust 异步生态及 Tower 中间件配合 | 无需微服务、消息队列或 GraphQL |
| 数据库 | PostgreSQL，关系约束、事务和成熟备份工具 | SQLite 更轻，但并发管理和后续查询更适合统一使用 PostgreSQL |
| 数据访问 | SQLx，明确 SQL 与迁移 | 不混用多个 ORM，避免事务和模型重复 |
| 鉴权 | 数据库 Session | 暂不使用 JWT 刷新令牌、多租户或 OAuth |
| 媒体 | 本地持久卷 + 元数据 | 有多实例或大流量需求时迁移 S3 兼容存储 |
| 部署 | 单机 Docker Compose + Caddy | 无需 Kubernetes；单机故障恢复依靠备份 |

Axum 提供路由、提取器及 Tower 生态集成，见 [Axum 官方文档](https://docs.rs/axum/latest/axum/)。SQLx 提供异步数据访问，运行时与 TLS 特性需要在依赖中明确启用，见 [SQLx 官方文档](https://docs.rs/sqlx/latest/sqlx/)。

版本策略：初始化时选择互相兼容的稳定版本，验证 Node/Rust 最低要求后固定工具链；提交 `package-lock.json`、`Cargo.lock` 与 `rust-toolchain.toml`，生产镜像使用固定版本或 digest。本文不使用“latest”作为生产版本约定。

## 2. 工程目录（目标结构与当前实现分开说明）

```text
PersonalWebsite/
  frontend/
    src/
      main.tsx             # React 启动入口
      app/                 # App、路由、Provider、导航配置
      layouts/             # PublicLayout / AdminLayout
      pages/public/        # 首页、关于、列表、详情
      pages/admin/         # 登录、资料、内容、媒体、设置
      pages/errors/        # 404、访问受限
      shared/
        components/        # UI、导航、内容、资料、媒体、反馈
        api/               # HTTP、错误、生成类型、业务请求
        queries/           # Query、mutation、缓存键
        session/           # 会话、Hook、后台守卫
        schemas/           # 复用表单校验
        hooks/             # 通用 Hook
        utils/             # 纯函数
        styles/            # tokens、reset、global
      assets/              # 参与构建的图片与字体
    scripts/               # 同步后端类型
    public/
    package.json
    package-lock.json
  backend/
    src/
      main.rs
      lib.rs
      app.rs
      config.rs
      error.rs
      state.rs
      routes/              # public/admin/auth/media/health/analytics/access
      middleware/          # session/csrf/request_id/limits
      modules/             # auth/profile/settings/content/taxonomy/media/analytics/access/dashboard/health/audit
      common/              # 分页、响应、时钟
      storage/             # 文件读写抽象
      bin/                 # migrate/admin-create/maintenance
    migrations/
    tests/
    Cargo.toml
    Cargo.lock
    openapi.json           # 后端契约生成产物
    docs/api-types.ts      # 同源生成的 TypeScript DTO
  deploy/
    compose.yaml           # 生产基础配置
    compose.dev.yaml       # 仅开发覆盖配置
    Caddyfile
    Dockerfile.frontend
    Dockerfile.backend
    .env.example
  docs/
    pages/                 # 保留公开站、详情、登录和后台原型
    documents/             # 本文档集
```

前端已完成入口、完整页面路由、共享层及公开站/后台第一版，类型检查与生产构建通过，真实 API 闭环尚待联调；详细目录、职责、现状和实施顺序见 [13 前端框架规划](13-frontend-framework.md)。

后端已按上述目录实现服务、SQL 迁移、业务模块、中间件、CLI 和测试，完整职责见 [backend/README.md](../../backend/README.md)，本地验证记录见 [实现记录](../../backend/docs/implementation.md)。前端 API 接入、生产代理与部署恢复仍待完成。

## 3. 核心请求链路

读取内容：浏览器路由 → Query 查询 → `/api/v1/posts/{slug}` → Caddy → Axum → `status=published` 条件查询 → 公开 DTO → React 渲染。

保存内容：编辑页校验 → 带 Cookie、CSRF token、version 的请求 → 会话与 Origin 检查 → 后端字段/媒体/分类校验 → 数据事务 → 更新关系和版本 → 提交 → 前端刷新缓存。

发布内容：读取并锁定当前内容 → 检查版本和允许转换 → 校验正文与关联媒体 → 更新状态、首次发布时间与版本 → 写审计 → 同一事务提交。公开站下一次请求立即读取新状态，不依赖前端重新部署。

## 4. 公共站与后台共用的边界

公开站与后台共用类型、Markdown 渲染、图片组件和基础 UI；后台路由单独分包。公开接口绝不返回管理员密码散列、Session、私有媒体存储键或内部审计数据。

前端路由守卫只改善体验。Rust 的 `/admin/*` 路由必须统一挂载鉴权；媒体读取也单独检查是否公开或持有有效管理员会话，不能通过静态目录绕开。

## 5. 渲染与 SEO 路线

首期采用 SPA。页面可设置标题、描述、canonical、语义化结构，并由 Rust 动态输出仅含已发布路径的 sitemap；这无法保证不执行 JavaScript 的爬虫获取详情正文和分享卡片。该限制是首期明确接受的取舍。

需要更完整收录时，将公开站迁移到 React Router framework 的 SSR 模式，由独立 Node 服务向 Rust API 取数据；Caddy 按路径代理，Rust 继续掌管业务和数据库，后台保留 SPA。渲染模式能力见 [React Router 官方文档](https://reactrouter.com/start/framework/rendering)。不要只在构建时静态生成页面而不设计内容更新后的重建机制，否则违背后台更新直接生效的目标。

## 6. 一致性与可扩展性

初期只有一个后端实例，无 Redis。Session、审计、业务内容在 PostgreSQL；API 不做服务端结果缓存。数据库与文件系统无法组成一个普通 SQL 事务，上传采用临时文件、原子重命名和补偿清理，见 [后端设计](04-backend.md)。

扩展多实例前，必须先把媒体迁往共享对象存储，并将限流与任务锁移到共享设施。公开访问量增加时优先优化图片、SQL 索引和静态资源，不因假设流量而预先拆服务。

## 7. 配置边界

构建时只注入公开前端配置，API 默认相对路径。运行时后端读取数据库凭据、会话配置、媒体目录和可信站点 Origin；秘密通过文件挂载提供。浏览器中任何 `VITE_*` 变量都应被视为公开信息。

开发、测试、生产使用独立数据库、媒体目录和账号；测试不能复用生产凭据。Windows 上开发使用 Docker Desktop Linux 容器或 WSL2，生产采用 Linux，避免混用 Windows 容器行为。
