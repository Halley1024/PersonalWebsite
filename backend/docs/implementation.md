# 后端实现与验收记录

本次只实现后端，保留原型和前端目录。实现以开发文档 04/05/06/07/10/11 为依据，沿用 profile 的 handler/service/repository 分层、From/TryFrom 转换及行尾中文成员注释。执行前源码备份位于 `/tmp/personalwebsite-backend-sources-before-completion-20261025.tar.gz`，权限为 0600。

## 实现覆盖

- 37 条路径、49 个 HTTP 操作；详见 [OpenAPI](../openapi.json)。
- 健康检查、公开资料和站点设置、登录/会话/退出/改密码、管理资料设置。
- 博客/作品/生活 CRUD、状态机、分类标签、分页/字面搜索、公开详情与 sitemap。
- 上传、JPEG/PNG/WebP 签名检查、尺寸/像素与内存限制、WebP 重编码、缩略图、EXIF/GPS 清理、媒体访问权限、引用检查、删除失败重试。
- dashboard 内容数量与最近编辑；PV/每日及区间 UV、来源、设备、热门内容、日期补零、环比、访问明细；停留时间始终为 null。
- 单 IP/区域规则、版本检查、期限、禁用/删除、未知区域降级、可信代理内部检查和 CLI 误封恢复。
- 默认 1MiB JSON、上传 12MiB 请求体/10MiB 文件、pageview 4KiB；普通请求 15s、上传 30s 超时。
- 全局 request_id、结构化日志、统一 JSON 错误和 no-store/nosniff。HTTP 审计与业务共用事务，并记录请求 ID；CLI 审计允许没有 HTTP 身份。
- 独立 migrate、admin-create、admin-reset-password、access-rule-disable、maintenance 命令。

管理写入保护在路由生效前建立，没有无鉴权的管理写入口。管理员 Cookie 明文 token 不入库，只保存 SHA-256；密码 Argon2id 使用 64MiB/3 次/并行度 1，密码计算并发上限 2。有效会话访问时会同步刷新 Cookie 的剩余期限，退出和改密码不会被续期逻辑覆盖。输入密码不裁剪；登录失败统一提示，未知用户名也执行等成本验证。限流为进程内、有界的单实例窗口。

## 与 profile 原型的衔接

`get_profile_handler/get_profile_service/find_profile_repository` 命名保留。原有 Profile、PublicProfileDto 和转换实现继续使用；经历字段按用户选择统一为 `start_date/end_date`，保存 YYYY-MM 月份。`id` 字符串转 UUID 失败作为内部数据异常处理，不随机修复或静默丢弃。

handler 不再独立生成 request_id 或重复拼接错误 envelope，而是返回统一 AppResult，由全局中间件处理。error.rs 定义业务错误及 HTTP 映射，common/response.rs 定义成功响应形状，两者不是重写标准库错误。

资料/设置/内容更新必须提交完整字段，缺字段或未知字段拒绝；null 和空数组保留清空语义。写操作校验旧 version，主表、扩展、关系和审计在同一事务提交。内容详情使用重复读快照，避免多次查询拼接不同已提交版本。公开响应不返回管理状态、内部版本或媒体存储键。

## 区域数据源

未配置 GEOIP_FILE 时，不虚构归属地，所有 IP 归入 unknown；IP 封锁可用，区域创建返回 503。可选本地 CIDR JSON 由运维从可靠数据源转换提供，例如以下保留文档网段仅用于说明格式：

```json
[
  {
    "cidr": "192.0.2.0/24",
    "region_id": "example-region",
    "label": "示例区域",
    "lookup_code": "example-code",
    "network_label": null
  }
]
```

设置 GEOIP_FILE 为绝对路径，启动时校验并同步区域目录，按最长前缀匹配。历史目录保留以满足事件外键，但不属于当前目录的条目不允许创建新封锁。数据源版本、准确性和更新流程由部署方记录；本轮没有下载或宣称提供真实商业 IP 地理库。

## 文件清理与隐私

开发 HMAC 密钥首次启动生成并持久化到媒体根目录的隐藏文件；生产必须提供至少 32 字节的二进制 secret 文件，不允许随部署更换密钥。媒体目录是私有目录，不能让代理直接公开它或其中的隐藏文件。

媒体原图总配额首期固定 2GiB；剩余磁盘空间少于 512MiB 拒绝新上传。图片解码并发上限 2，并限制尺寸和最大解码分配。文件落盘失败/数据库写入失败会清理可识别的文件，崩溃留下的未入库文件由维护扫描延迟超过 24 小时后报告；加 --cleanup-media 才清理，并在删除前复查数据库。正常 unused 媒体不自动删除。孤立文件扫描只识别年月/UUID/原图或缩略图的受管布局，不清理媒体目录中的运维配置或其他普通文件。

删除先锁媒体并检查全部引用，再标记 deleting、提交审计并删除文件，最后删除元数据；失败保留 deleting 状态供重试，不允许再建立引用。引用建立按 UUID 顺序锁媒体，内容保存再锁主记录，并使用版本判断拒绝过期写入。

## 验证结果

已运行：

```text
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
python3 scripts/test_database.py
python3 scripts/generate_openapi.py --check
```

单元测试 9 项；独立 PostgreSQL 综合流程通过，包含实际并发更新、媒体引用/删除竞争、单连接池发布、事务回滚、multipart 图片处理、公开权限、跨日 UV、规则、Cookie 滑动续期和维护场景。脚本额外启动真实 TCP 服务，通过 /health/ready 和 /api/v1/profile；测试结束停止服务并删除临时数据库。详见 [测试说明](../tests/README.md)。

测试账号、文章、媒体及测试区域只写入随机临时库，不向现有 personal_website 业务库导入默认管理员或演示数据。现有 0001–0005 迁移文件没有改写，也没有对业务库执行删除或结构重建。

## 尚需部署或前端验收的内容

- 前端尚未改成真实 API/Cookie/CSRF 工作流；原型 localStorage 和示例统计不代表已经联调。
- Caddy 必须为公开 SPA 文档调用 /internal/access-check；后端只能直接拦截 API、媒体和 sitemap，不能单独拦截代理提供的静态 HTML。
- 未完成生产 HTTPS、域名、容器镜像、数据库运行/迁移角色权限、磁盘配额实测和系统定时调度。
- 未做备份恢复、压力测试、真实归属地准确性、浏览器 Markdown 消毒和整站 E2E。
- 49 个操作已挂载并通过契约路径检查，但综合测试不能替代所有接口的每一种参数组合、并发故障与生产安全审查。

没有实现独立编辑修订稿、多用户、评论、RSS、SSR、Redis、对象存储或跨实例共享限流，这些属于文档的后续演进范围。
