# PersonalWebsite Rust 后端

基于 Axum/Tokio、SQLx/PostgreSQL 的模块化单体后端。业务按 `handler → service → repository` 分层，DTO 转换使用 `From/TryFrom`，结构体成员使用行尾中文注释。公开查询和管理写入分别挂载，管理写入需要 Session、Origin 和 CSRF。

设计入口：[开发文档](../docs/documents/README.md)。完整接口见 [OpenAPI](openapi.json)，生成的数据类型见 [api-types.ts](docs/api-types.ts)，实现与验收边界见 [后端实现记录](docs/implementation.md)。

## 本地运行

PostgreSQL 数据库必须已存在，使用你已经启动的数据库容器。真实密码不要写进源码、命令行参数或 Git。

```bash
cd /home/halley/Projects/PersonalWebsite/backend
read -rsp '请输入数据库连接串：' DATABASE_URL
echo
export DATABASE_URL
export PUBLIC_ORIGIN=http://localhost:5173
export MEDIA_ROOT=./data/media
cargo run --bin migrate
cargo run --bin admin-create
cargo run --bin backend
```

连接串形如 `postgres://用户名:经过URL编码的密码@127.0.0.1:5432/数据库名`。管理员账号与密码由交互式 CLI 创建，没有默认密码或注册接口。`admin-create` 再次执行会因单管理员约束而拒绝。

查看 `.env.example` 了解配置，但程序不会自动加载 `.env`。在一个终端导出的变量也不会自动进入其他终端或 IDE。

```bash
curl --noproxy '*' -i http://127.0.0.1:8080/health/ready
curl --noproxy '*' -i http://127.0.0.1:8080/api/v1/profile
```

开发环境默认来源为 `http://localhost:5173`；前端通过同源代理访问后端。写请求的 Origin 必须与 PUBLIC_ORIGIN 完全一致。当前不会开启宽泛 CORS。

## 已实现能力

| 模块 | 能力 |
| --- | --- |
| health | 存活；数据库、迁移版本和 checksum 就绪检查 |
| auth | 单管理员初始化、Argon2id、登录/会话/退出、改密码、服务器重置密码 |
| profile/settings | 公开读取；完整管理更新；版本冲突保护；头像关联 |
| taxonomy | 按类型查询、创建、更新、删除分类标签；引用与版本检查 |
| content | 博客/作品/生活；草稿、发布、下线、归档、恢复、删除；搜索筛选分页；sitemap |
| media | 流式接收、格式/像素校验、受并发限制的重编码、缩略图、引用权限、删除与重试 |
| dashboard | 内容数量、最近编辑，和流量统计分开 |
| analytics | 幂等 pageview、访客 Cookie/HMAC、北京时间 7/30 天聚合、区间 UV、访问记录 |
| access | 单 IP/区域规则、期限、禁用/删除、公开 API/媒体/sitemap 检查、可信代理内部检查 |
| audit | 管理写操作与审计共用事务；HTTP 审计关联请求 ID |

经历月份使用 `start_date/end_date`，值仍然是 `YYYY-MM`。已发布内容保存后立即公开，当前不实现独立编辑修订稿。

## 代码布局

- `main.rs`：初始化日志与依赖、绑定监听器、优雅关闭。
- `config.rs/state.rs`：配置、连接池、时钟、密码/图片并发控制、持久 HMAC 密钥、区域数据源。
- `app.rs/routes/`：应用组装和路径挂载，不写业务 SQL。
- `middleware/`：请求 ID、可信客户端 IP、来源/会话/CSRF、限流、访问控制、统一响应头和错误。
- `modules/*/handler.rs`：提取输入，调用 service，构造 HTTP 响应。
- `modules/*/service.rs`：校验、状态机、事务边界、模块协作和模型转换。
- `modules/*/repository.rs`：参数化 SQL，接受 service 传入的事务。
- `storage/local.rs`：私有媒体路径、读取、原子落盘与删除。
- `cli.rs/src/bin/`：独立服务器管理命令，复用配置和业务服务。

健康检查是基础设施检查，直接执行依赖探针，不建立没有业务意义的多层透传。内容和管理列表使用显式构造的查询视图；公开响应会排除状态、版本、存储键等内部字段。

## CLI

```bash
cargo run --bin migrate
cargo run --bin admin-create
cargo run --bin admin-reset-password
cargo run --bin access-rule-disable -- <规则UUID>
cargo run --bin maintenance
cargo run --bin maintenance -- --cleanup-media
```

maintenance 每次都清理过期会话、60 天事件、180 天审计、365 天汇总，并重算近期汇总。默认只报告旧临时/孤立文件及待重试删除媒体；只有 `--cleanup-media` 才执行文件清理。正常未引用媒体不会被自动清理。

现有 SQL 迁移不修改，后续结构调整增加更大的迁移版本。迁移二进制部署时要提供 SQL 目录，并设置 `MIGRATIONS_DIR`；详见 [迁移说明](migrations/README.md)。

## 测试

```bash
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
python3 scripts/test_database.py
python3 scripts/generate_openapi.py
```

默认 `cargo test` 执行业务单元测试，真实数据库流程测试显式忽略。`test_database.py` 在现有 PostgreSQL 容器中创建随机临时数据库，运行迁移和业务验收，再启动随机本机端口的短期 HTTP 服务验证，最后停止服务并删除测试库。脚本需要 Docker 访问权限，不会向已有 `personal_website` 写测试账号或文章。容器名可通过 `POSTGRES_TEST_CONTAINER` 配置。

OpenAPI 脚本维护接口 schema，并检查 37 个实际路由、49 个操作与契约一致，生成 TypeScript 数据类型；它不是从 Rust 字段自动推导 schema，修改 DTO 时需同步修改生成脚本。

## 生产配置边界

生产设置 `APP_ENV=production`、HTTPS 的 `PUBLIC_ORIGIN`、`DATABASE_URL_FILE`、至少 32 字节的二进制 `VISITOR_HMAC_KEY_FILE`，以及私有可写的 `MEDIA_ROOT`。不允许使用开发 Cookie 名。HMAC 密钥须在完整统计窗口内稳定，不能随部署更换；开发密钥默认保存在媒体根目录的隐藏文件中。

后端端口只对代理开放，媒体卷不得直接作为公开静态目录。`TRUSTED_PROXIES` 默认为空；配置为真实代理网段后，才读取可信转发链并开放 `/internal/access-check`。前端 SPA 文档请求要由 Caddy 调用内部检查，管理/登录/health 路径应豁免业务封锁。单独运行后端不能替代 Caddy 静态入口拦截。

无 GEOIP_FILE 时统一归入 unknown，IP 规则正常执行，创建区域规则返回 503。可选数据源格式见实现记录；不能把测试区域目录当作真实归属地数据。

限流为进程内单实例实现，重启会清零。图片最多 40MP、单边 12000px、上传 10MiB；首期原图总配额 2GiB，磁盘可用空间不足 512MiB 时拒绝新上传。没有接入 S3、Redis 或任务队列。

前端页面联调、生产代理/HTTPS、容器镜像部署、备份恢复、服务器容量与压力测试仍需单独验收。本轮没有部署线上服务。
