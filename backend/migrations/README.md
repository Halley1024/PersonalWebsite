# 数据库迁移

本目录对应 [数据存储设计](../../docs/documents/06-data-storage.md) 和 [流量统计及访问控制](../../docs/documents/11-analytics-and-access-control.md)。SQL 文件含中文表用途、字段与约束注释。

## 迁移清单

| 版本 | 文件 | 内容 |
| --- | --- | --- |
| 0001 | `0001_create_site_settings.sql` | 站点设置及单例初始化；保留原有文件，未改写 |
| 0002 | `0002_create_accounts_media_profile.sql` | admins、admin_sessions、media_files、site_profile；初始化空白资料 |
| 0003 | `0003_create_content_taxonomy.sql` | categories、tags、content_items、project_details、life_details、content_tags、content_media |
| 0004 | `0004_create_audit_analytics_access.sql` | audit_logs、region_catalog、visit_events、analytics_daily、access_rules；初始化 unknown 区域 |
| 0005 | `0005_create_query_indexes.sql` | 查询、媒体引用、会话清理、审计和访问统计索引 |

共 17 张业务表；SQLx 另行维护 `_sqlx_migrations`。不创建默认管理员、密码、演示内容、虚构流量或未部署数据源的区域目录。唯一管理员后续由 `admin-create` 实现。

现有 `admin.sql` 是用户预留的空文件，保持不变；它不符合 SQLx 的版本命名规则，不参与迁移。

## 执行方式

先在执行命令的同一终端设置并导出 `DATABASE_URL`。连接串格式为 `postgres://用户名:密码@地址:端口/数据库名`，密码中的 URL 特殊字符需编码。不要提交真实凭据。

```bash
cd /home/halley/Projects/PersonalWebsite/backend
read -rsp '请输入数据库连接串：' DATABASE_URL
echo
export DATABASE_URL
cargo run --bin migrate
```

`migrate` 复用 `Config::from_env()`，不会自动读取 `.env`，也不会启动 HTTP 服务或修改 `main.rs`。数据库必须事先存在；命令负责建表和后续结构迁移，不负责 `CREATE DATABASE`。数据库账号须具备目标 schema 的建表权限；生产迁移使用独立 DDL 账号，Web 运行账号另行限制。

默认运行时读取本源码目录。部署单独二进制时，一同提供 SQL 文件，并使用绝对路径指定目录：

```bash
MIGRATIONS_DIR=/实际部署目录/migrations ./migrate
```

保留 SQLx 默认迁移锁、每个迁移的事务以及版本/checksum 校验。每个文件分别提交；后续文件失败不撤销已成功的前序版本。修复失败原因后重新运行，已成功版本不会重复执行。已执行迁移不可改写、重命名或删除；后续修改新增更大的版本号，不通过 `IF NOT EXISTS` 隐藏结构漂移。

## 数据库与应用的职责

- 数据库保证单管理员/单例资料设置、类型枚举、正版本、字段长度与 JSON 容器类型、媒体尺寸、会话摘要长度、外键完整性和必要唯一性。
- 分类、标签、作品/生活扩展使用复合外键保证与内容 kind 一致；内容删除级联清理扩展及关系，不级联媒体，历史访问事件的 content_id 置空。
- 相册位置非负且同内容唯一；IP/区域目标互斥且每目标唯一，unknown 不允许作为封锁目标，IP 不接受 CIDR。
- 服务层后续负责状态转换、kind/slug 不可修改、版本原子递增、更新时间维护、首次发布时间保留、每类扩展完整性、相册连续位置、JSON 元素结构及 URL/邮箱详细校验。
- 媒体 ready/可见性、跨表引用锁协议、权限、CSRF、审计与业务同事务、IP 地址归一化及区域 blockable 检查仍须由后续业务实现。本次没有实现这些服务。
- audit_logs.resource_id 使用 text 兼容 UUID 与单例整数目标；admin_id 允许为空以支持无 HTTP 登录会话的服务器恢复操作。服务端必须记录真实操作者，不因可空而省略正常管理操作的管理员关联。
- analytics_daily.date 表示北京时间自然日。visitor_hash 保存非空 HMAC 字节，hash_key_version 为正整数；算法及密钥由后续统计服务配置，不能用日 UV 求和计算区间 UV。

## 已执行验证

在现有 PostgreSQL 18 容器的独立临时数据库中运行实际 SQLx 二进制，验证：

- 从空库执行全部五个迁移，随后重复执行。
- 17 张业务表、初始化记录与不创建默认管理员/内容。
- 单管理员、资料 JSON 类型、会话摘要、跨 kind 分类标签/扩展约束及项目日期约束。
- 发布必须有 published_at，引用媒体/标签不能删除，相册位置非空约束。
- unknown/CIDR 封锁拒绝、同 IP 规则唯一、event_id 重试去重。
- 删除内容清理扩展及关系，同时保留媒体和历史事件。
- 已应用 SQL 文件被改动后触发 checksum 错误。

验证结束已清理临时数据库，再向 `personal_website` 应用全部迁移并重复执行成功。未执行备份恢复演练、并发业务事务或 HTTP 功能验证。
