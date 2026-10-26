# Docker 部署、备份与运维

上级文档：[开发总览](README.md)。目标为一台 Linux 服务器运行 Docker Engine 与 Compose v2；Windows 开发机使用 Docker Desktop 的 Linux 容器。

本文描述待实现部署方案，引用的 Dockerfile、Compose 文件、二进制和脚本尚未创建。首次实现后需补充实际版本、命令输出与演练结果。

## 1. 服务拓扑与数据卷

| 服务 | 职责 | 暴露端口/存储 |
| --- | --- | --- |
| `web` | 自定义 Caddy 镜像，包含 React 构建产物和 Caddyfile | 仅此服务发布 80/443；caddy_data、caddy_config 卷 |
| `backend` | Rust API 与媒体读取 | 仅容器网络 8080；media_data 卷，数据库连接 secret |
| `db` | PostgreSQL | 仅内部网络 5432；pg_data 卷，密码 secret |
| `migrate` | 一次性迁移任务，使用后端镜像不同命令 | tools profile；DDL 账号 secret，成功后退出 |
| `backup` | 一次性转储/媒体归档任务，外部 timer 调度 | backup profile；只读媒体卷、专用备份凭据与输出目录 |

web 加入外部网络以获取证书，同时加入应用网络；backend 和 db 在内部网络，不发布宿主机端口。Caddy 数据卷用于证书持久化。PG 镜像主版本在实施时固定，数据库挂载路径必须与选定镜像一致，不能只改镜像主版本后直接复用旧目录。

Docker volumes 可使数据独立于容器生命周期，见 [Docker 卷文档](https://docs.docker.com/engine/storage/volumes/)。删除容器或替换镜像不应影响卷；生产不得把删除卷当作日常重启方式。

## 2. 构建与镜像

前端多阶段构建：Node builder 执行 `npm ci`、类型检查和 build，再复制 dist 到 Caddy 镜像 `/srv`。Rust 多阶段构建：固定 Rust 工具链，`cargo build --locked --release`，把 API 与迁移/管理二进制复制到精简运行镜像，保留必要 CA 证书。

后端使用非 root UID，媒体卷初始化时授予该 UID 写权限。镜像中不包含源码密钥、数据库、媒体、个人 `.env` 或管理员密码。生产不挂载源码；前后端镜像用相同 Git SHA/发布编号，便于配套回退。

数据库、Caddy、Node builder、Rust builder 镜像都锁定版本或 digest，并通过更新流程升级。按 [Docker Compose 生产指南](https://docs.docker.com/compose/how-tos/production/) 区分生产与开发配置，开发源码热更新挂载仅放在 `compose.dev.yaml`。

## 3. 配置与秘密

| 配置 | 提供方式 | 说明 |
| --- | --- | --- |
| SITE_DOMAIN / PUBLIC_ORIGIN | 非敏感环境变量 | 域名与 `https://域名`，必须一致 |
| IMAGE_TAG / 镜像引用 | 发布环境文件 | 固定到已验证版本，不用 latest |
| 数据库密码 | `/run/secrets/db_password` | PostgreSQL 按镜像支持的 `_FILE` 配置读取 |
| 后端数据库 URL | `/run/secrets/database_url` | backend 读取 DATABASE_URL_FILE，含受限运行账号 |
| 迁移数据库 URL | 单独 secret | 只给 migrate，带 DDL 权限，不给 Web 服务 |
| 备份凭据与加密密钥 | 受限文件或备份工具密钥机制 | 不写入公开环境示例，不进入日志 |
| MEDIA_ROOT / APP_ENV / LOG_LEVEL | 后端环境变量 | `/data/media` / production / info |

Compose secrets 按服务授权并挂到容器文件，见 [Docker 官方指南](https://docs.docker.com/compose/how-tos/use-secrets/)。本地 Compose 的文件 secret 仍依赖宿主机文件权限，不等于自动加密保险库；宿主机秘密文件需限制为部署用户可读，并做好受控恢复副本。

前端 `VITE_*` 仅允许公开配置，默认直接请求相对路径。禁止在前端注入数据库 URL、管理员密码或任何第三方 API secret。

## 4. Caddy 路由设计

以下仅为基础代理示意，尚未包含下述访问规则检查；不可作为完整生产配置直接使用。部署文件实现后需验证：

```caddyfile
{$SITE_DOMAIN} {
    encode zstd gzip

    handle /api/* {
        reverse_proxy backend:8080
    }
    handle /sitemap.xml {
        reverse_proxy backend:8080
    }
    handle /health/* {
        respond 404
    }
    handle /assets/* {
        root * /srv
        header Cache-Control "public, max-age=31536000, immutable"
        file_server
    }
    handle {
        root * /srv
        header Cache-Control "no-cache"
        try_files {path} /index.html
        file_server
    }
}
```

使用 `handle` 保留 `/api/v1` 前缀，不用会剥离路径的配置，行为见 [Caddy handle 官方文档](https://caddyserver.com/docs/caddyfile/directives/handle)。`/api/*` 返回的 404/500 必须保持 API 响应，不能回退 index.html。robots.txt 放入前端 public，禁止抓取 `/admin`。未知 `/assets/*` 资源直接 404，避免把 HTML 返回给脚本加载器。

部署域名需正确解析、80/443 可达，Caddy 才能自动获取和续期 HTTPS 证书。安全响应头与 CSP 在实施时加入并联调；生产日志配置大小与数量轮转。不得为调试把数据库端口开放到公网。

## 5. 首次部署步骤

1. 创建部署目录与受限秘密文件；确认域名、防火墙、Docker/Compose、磁盘、时区与异机备份位置。
2. 构建或拉取指定版本的 web/backend 镜像，检查 Compose 解析结果不泄露 secret 内容。
3. 启动 db，健康检查就绪后创建应用、迁移和备份数据库账号并授予各自所需权限；此初始化仅空数据卷执行一次。
4. 运行 migrate，一次性执行完整迁移；失败停止后续步骤。
5. 用 admin-create 交互创建管理员，初始化真实资料与设置。
6. 启动 backend、web，确认后端 ready、HTTPS、SPA 深链接、API 路径与媒体权限。
7. 登录、保存资料、创建草稿、上传、发布、下线并重新读取验证。
8. 完成一次备份与隔离恢复演练，再把站点作为正式可维护服务。

未来的运维命令形态如下，实际文件与二进制实现前不可直接套用：

```sh
docker compose -f deploy/compose.yaml up -d db
docker compose -f deploy/compose.yaml --profile tools run --rm migrate
docker compose -f deploy/compose.yaml --profile tools run --rm -it migrate admin-create
docker compose -f deploy/compose.yaml up -d backend web
```

工具服务约定 ENTRYPOINT 为后端镜像中的工具分派程序，默认执行 migrate，参数 admin-create 分派到管理员命令。若实现采用不同入口，需同步改正文档，不混用不可运行的示例。

## 6. 升级与回滚

升级前保存当前镜像编号并建立一致性备份；先在备份副本上验证新迁移。尽量采用增加字段/表再切换代码的兼容迁移。运行新迁移、启动新 backend/web 后验证登录、公开详情和媒体；单机重启可能短暂不可用。

仅在数据库结构向后兼容时回退旧应用镜像。破坏性迁移不能简单回滚代码，应维护窗口恢复完整数据库和媒体备份，再启动与备份对应的镜像版本，并告知该备份时间之后的数据可能丢失。数据库主版本升级另做 pg_dump/restore 或经验证的升级流程，不能当作普通镜像替换。

## 7. 备份计划与一致性

初始目标：RPO ≤24 小时，RTO ≤2 小时；这是需要演练验证的目标，不是已达到的保证。每天低峰备份，保留最近 7 个每日、4 个每周、3 个每月备份，至少一份加密复制到不同机器/存储位置。

备份集合包含：PostgreSQL custom-format dump、媒体原件和缩略图、部署配置的非敏感副本、镜像版本/迁移版本、文件数量和校验清单。恢复秘密所需材料另行受控保存，不把解密密钥和密文放在同一个无保护目录。

首期采用短维护窗口确保数据库与图片一致：

1. 阻止新管理写入，停止 backend 及所有会写业务数据/媒体的工具任务，等待正在执行的上传和事务结束；db 保持运行，web 可展示维护提示。
2. 运行 `pg_dump -Fc` 输出到受限备份目录，同一窗口归档完整 media_data（排除 .tmp 临时文件），记录 UTC 时间、镜像和校验值。
3. 本地归档验证完成后恢复 backend 与维护任务，不等待异机上传完成才恢复站点。
4. 加密备份并上传异机，检查远端对象存在与校验；任何一步失败保留可诊断记录并通知运维渠道。

不直接打包正在运行的 PostgreSQL 数据目录，也不只备份数据库而遗漏图片。若后续要求无维护窗口备份，应增加写入冻结或快照协调机制后再调整。

`pg_dump/pg_restore` 使用与数据库兼容的工具版本。逻辑备份不自动涵盖数据库角色，角色权限用受控初始化脚本重建；恢复脚本使用正确 owner/权限选项，不能假设 dump 会重建宿主机账号。

## 8. 恢复演练

在独立 Compose project、独立卷和独立端口恢复，避免覆盖生产。先校验备份与解密，再创建兼容数据库和账号、导入 dump、恢复媒体与目录所有权，核对迁移版本，启动备份匹配的应用镜像。

恢复后清空 admin_sessions，要求重新登录；隔离环境不连接生产异机清理任务。核对资料、三类内容数量、标签关系、随机多张图片、draft 不可见、后台可写。记录实际恢复耗时和缺失项；通过后再将演练环境按确认的 project/卷清理。

真实故障恢复完成后变更 DNS/入口前复核生产数据边界，确保恢复期间产生的新内容没有被无声覆盖。每月演练一次，每次重要数据库变更后追加演练。

## 9. 监控与日常维护

内部监控 live/ready、5xx 比例、请求耗时、登录失败、磁盘容量、数据库连接数、最近成功备份时间和证书续期。健康检查用镜像内实际可用的探测命令，不能假设精简镜像一定有 curl。

日志按大小轮转，安全日志和审计按保留周期清理。定期验证依赖更新、备份可读性与媒体孤立文件报告。卷满、数据库断开、迁移失败时明确失败，不悄悄把内存或容器临时目录作为持久存储替代。

## 10. 流量采集与规则执行的部署补充

流量/访问控制协议见 [11](11-analytics-and-access-control.md)。上述基础配置在正式实现中须补上：

1. 公网拒绝 `/internal/*`；backend 端口仍仅内部开放。
2. 公开文档与 sitemap 的处理器在返回页面前调用内部 `GET /internal/access-check`，仅 204 放行；403 输出通用封锁页，503 输出服务不可用。不得在 React 的 SPA 回退之后检查。
3. API/媒体由 Rust 中间件执行同一检查；管理及登录页面按精确路径豁免业务封锁，依然受独立认证和限流约束，不能把任意 `/admin-xxx` 当管理入口豁免。
4. `/assets/*` 只含公共不可变构建资源，可保持静态缓存；业务图片仍只能通过 Rust 读取。检查请求不进入 pageview 统计，避免递归与重复计数。
5. Caddy 覆盖访客转发头，Rust 配置可信代理地址段；接 CDN 时验证实际客户端 IP 来源，禁止直接相信任意头。

此处为部署要求，具体 Caddy 语法与返回码转发在实施时核对并通过配置检查、真实 HTTP 用例验证；基础示意本身不构成访问封锁实现。

新增配置：`GEOIP_DB_PATH`（只读挂载的数据源）、`TRUSTED_PROXY_CIDRS`、`VISITOR_HASH_KEY_FILE`（secret）、`VISIT_RETENTION_DAYS=60`、`ANALYTICS_RETENTION_DAYS=365`。配置 visitor hash 密钥轮换版本并保留恢复副本，不能每次重启随机生成。原始事件保留 60 天以覆盖 30 天环比，不能随意改成 30 天后仍保留相同统计承诺。

maintenance 由宿主 timer 每日运行，重算日汇总、清理到期事件/会话与媒体临时文件；失败记录告警。区域目录和归属地库成套部署，记录数据来源和更新版本；未知区域不生成虚假位置，缺库时区域规则创建不可用。恢复备份后验证规则表、密钥和目录匹配，再执行过期数据清理。
