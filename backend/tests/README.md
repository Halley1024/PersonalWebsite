# 后端测试

## 快速检查

```bash
cd /home/halley/Projects/PersonalWebsite/backend
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
```

目前包含 9 个单元测试：slug、外链协议、分页/LIKE 转义、经历月份、内容状态机、Markdown 媒体引用、路径穿越、图片伪装/损坏和 IPv4-mapped IPv6 归一化。

## 独立 PostgreSQL 验收

```bash
python3 scripts/test_database.py
```

默认使用 `personal-website-db` 容器。助手只在内存中读取容器配置，创建随机临时库；测试中账号、内容、图片都位于测试库和临时媒体目录。结束后清理测试库及 HTTP 服务。需要当前用户有 Docker 权限。测试失败时数据库仍会清理，媒体临时目录可能保留用于排查。

也可手动创建空库，通过环境变量设置 TEST_DATABASE_URL，再运行：

```bash
cargo test --test backend_flow -- --ignored --nocapture
```

仍需提供配置读取需要的 DATABASE_URL，且它不能与 TEST_DATABASE_URL 相同；测试会覆盖 AppState 连接串为 TEST_DATABASE_URL。测试拒绝非空库，不允许拿生产或已有业务库做验收。

`backend_flow.rs` 是一个按顺序执行的综合场景，覆盖：

- 迁移、就绪、真实个人资料、统一响应头。
- 管理未登录、Origin/CSRF 缺失、登录失败/成功及退出、Cookie 滑动续期、过期会话和登录失败限流。
- profile/settings 保存及版本冲突；审计失败回滚；错误隐藏内部原因并关联请求 ID。
- 分类/标签、跨 kind 引用拒绝、草稿不可公开、发布校验、两次并发更新只有一个成功、单连接池发布无连接自锁。
- 真实 multipart 图片上传、重编码、私有读取、公开引用、下线撤权、引用删除拒绝及最终删除、引用建立与媒体删除竞争。
- 三种内容、列表、详情、sitemap、首次发布时间保留和内容删除不误删历史事件。
- pageview 幂等、管理员排除、同访客跨日区间 UV、日期补零、空环比和未采集停留时间。
- IP 封锁、伪造转发头拒绝、管理入口豁免、CLI 误封恢复、重复目标冲突。
- 缺失区域库时返回 503；本地测试 CIDR 区域封锁与可信代理内部检查。
- 过期事件/汇总清理、旧孤立文件报告与清理、近期文件保留。
- 修改密码撤销会话、重新登录、退出撤销和服务器密码重置。

脚本还启动真实 TCP 服务验证 `/health/ready` 和 `/api/v1/profile`。其余接口主要通过 Axum Router + 真实 PostgreSQL 测试，不能称为已完成浏览器、Caddy、HTTPS、负载或恢复演练。
