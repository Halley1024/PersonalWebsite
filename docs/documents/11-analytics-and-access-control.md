# 流量统计、访问记录与封锁规则

上级文档：[开发总览](README.md)。当前 admin.js 的曲线、IP、地域和访问记录是脚本生成的示例，admin-access.js 仅在 localStorage 登记规则。本章定义统计和访问控制契约；Rust 后端已实现真实事件采集、查询和规则检查并完成本地验证，尚未与前端或生产代理联调。

## 1. 统计范围与口径

首期使用第一方页面事件统计，不使用第三方平台、不把 API/图片请求当 PV。统计为浏览器上报的近似访问数据：屏蔽脚本、清 Cookie、多设备或自动化访问会影响结果，不能称为精确人数。

| 指标 | 定义 |
| --- | --- |
| PV | 成功接收且 event_id 未重复的公开页面浏览事件；首屏与每次成功路由切换各计一次 |
| 每日 UV | 当天事件的 visitor_hash 去重数 |
| 区间 UV | 整个查询区间 visitor_hash 去重数；不能把每日 UV 相加 |
| 环比 | 与前一等长日期区间比较，返回百分数；基数为 0 返回 null |
| 热门内容 | 查询期事件按 content_id 分组计 PV，最多 10 项；仅展示当前仍已发布内容 |
| 来源 | Referer 域名推导 direct/github/search/bilibili/other；不保存完整带查询串 URL |
| 设备 | 服务端根据 User-Agent 归类 desktop/mobile/tablet/unknown，不长期保存原始 UA |
| 平均停留时间 | 首期没有可靠的离页/心跳采集，返回 null，UI 显示“暂未采集”，不套用演示数值 |

所有按天查询以 Asia/Shanghai 自然日为准；时间戳存 UTC。days=7/30 包括今天，今天数据尚未结束；环比对照前一完整等长自然日区间，UI 标注“含今日，尚未结束”。日期序列缺失补 0。来源/设备的计数以 PV 为分母，百分比展示可四舍五入。

visitor_hash 来源于服务端随机访客 Cookie 的 HMAC，不是 IP，也不使用浏览器指纹。Cookie 生产名 `__Host-visit_id`，Secure/HttpOnly/SameSite=Lax/Path=/，30 天有效，无 Domain；无 Cookie 时服务端生成至少 128 bit 随机值，开发使用独立非 Secure 名。HMAC 密钥从 secret 文件读取，整个查询窗口保持一致；轮换需保留 key 版本并明确历史身份不可自动合并。前端首次事件等待完成再发送下一事件，减少首次并发产生不同身份；Cookie 被禁用时每次可能计为新访客。

首期不做日 PV 硬编码，也不按 IP 估算停留时间。管理员有效会话的页面预览、后台路径、健康检查、媒体及规则检查不计入访客统计。

## 2. 浏览事件接口

`POST /api/v1/analytics/pageviews`，JSON，公开写入但只允许完全匹配 PUBLIC_ORIGIN 的 Origin 和 application/json；无需管理员 Session/CSRF。请求体上限 4 KiB，每可信 IP 每分钟初始上限 60 次，429 带 Retry-After。该策略只减少滥用，不能保证事件无伪造。

```json
{
  "event_id": "1c5d486b-f95f-4787-95dc-3747dc82cb7c",
  "page_path": "/posts/rust-error-handling",
  "referrer_origin": "https://github.com"
}
```

| 字段 | 规则 |
| --- | --- |
| event_id | 客户端为一次浏览生成 UUID；原事件重试保留同一 ID；最多自动重试一次 |
| page_path | 最长 300；仅 /、/about、/posts、/projects、/life 及合法公开详情；移除查询串和 hash，不接受外域/后台/文件路径 |
| referrer_origin | null 或标准化 http/https origin，最长 255；客户端从 document.referrer 提取，只作为可伪造的来源提示 |

时间、IP、visitor_hash、来源分类、设备和 region 均由服务端补充。详情路径必须查到 published 内容才接受；固定页面必须匹配白名单。有效管理员会话忽略并返回 204；未知/非公开详情返回 404。被封锁时 403 ACCESS_DENIED；字段非法 422。重复 event_id 和首次成功均 204，无响应体；唯一约束阻止重复计数。成功后事件立即可查询，不引入“202 但无持久化队列”的丢失语义。统计失败不阻断正文阅读，前端也不反复请求。

客户端不提交 content_id、IP、访问时间、地理位置或设备；后端通过规范化 page_path 关联内容 ID。事件不参与内容 version，不修改业务正文更新时间。

## 3. 管理查询接口与 DTO

统一继承 [05](05-api-contract.md) 的 Session/no-store；写请求另需 CSRF/Origin。未知查询参数、非法枚举或分页返回 400，响应都使用 data/meta。

| 方法与路径（/api/v1 下） | 查询/响应 |
| --- | --- |
| GET /admin/analytics | days=7 或 30，默认 7；返回 One<Analytics> |
| GET /admin/visits | start_date/end_date，含首尾的北京时间日期；默认最近 7 天，上限 30 天，且位于保留期内；q≤100、source、region_id、page/page_size（1/20，上限 50）；返回 Page<Visit> |
| GET /admin/regions | 返回 One<Region[]>，目录稳定排序；包含 unknown 供筛选，unknown 不可封锁 |
| GET /admin/access-rules | scope=ip/region、state=active/expired/disabled、q≤100、page/page_size（1/20，上限 50）；省略表示全部；返回 Page<AccessRule> |
| POST /admin/access-rules | 创建规则，201 One<AccessRule> 和 Location |
| PUT /admin/access-rules/{id} | 完整更新规则可编辑字段 + version，200 One<AccessRule> |
| DELETE /admin/access-rules/{id}?version=N | 永久删除，204；界面默认用禁用操作保留规则历史 |

visits.q 为 IP 文本、区域标签、运营商、页面标题/路径的字面子串；source 取来源枚举，region_id 必须来自目录，unknown 可用于筛选。日期 start_date≤end_date；未来日期或超出保留期返回 400。明细排序 occurred_at DESC,id DESC；规则 created_at DESC,id DESC。规则 q 匹配目标标签、IP 文本和原因；不开放自定义 SQL 排序。返回 Visit 时实时补充匹配的当前有效规则，不把旧日志改成伪造的“当时被封锁”。

```ts
type Source = 'direct' | 'github' | 'search' | 'bilibili' | 'other';
interface Region { id: string; label: string; blockable: boolean }
interface Visit {
  id: UUID; occurred_at: Instant;
  ip: string; region_id: string; region_label: string;
  network_label: string | null;
  page_path: string; page_title: string; content_id: UUID | null;
  source: Source; device: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  matched_rule_ids: UUID[]; // 当前规则命中，非历史判决
}
interface Analytics {
  timezone: 'Asia/Shanghai'; start_date: LocalDate; end_date: LocalDate;
  pv: number; uv: number;
  pv_change_percent: number | null; uv_change_percent: number | null;
  average_duration_seconds: null;
  series: { date: LocalDate; pv: number; uv: number }[];
  sources: { source: Source; pv: number }[];
  devices: { device: Visit['device']; pv: number }[];
  popular_contents: { content_id: UUID; kind: Kind; slug: string;
    title: string; pv: number }[];
}
interface AccessRule {
  id: UUID; scope: 'ip' | 'region'; target: string; target_label: string;
  action: 'deny'; reason: string; enabled: boolean;
  created_at: Instant; updated_at: Instant; expires_at: Instant | null;
  version: number; effective: boolean; // 服务端按当前时间计算
}
type RuleFields = {
  reason: string; enabled: boolean;
  duration_hours: 1 | 24 | 168 | null; // null 永久；PUT 重新从服务器当前时刻计时
} & (
  { scope: 'ip'; ip: string; region_id: null }
  | { scope: 'region'; ip: null; region_id: string }
);
// POST: RuleFields；PUT: RuleFields & {version:number}
```

规则 scope 和 target 创建后不可改；PUT 中必须与当前目标一致，否则 422；变更目标采用新建规则。原因 trim 后 1–200；enabled 必填，创建通常为 true；expires_at 不能直接由客户端提交。PUT 禁用时也提交当前期限策略；禁用不延长期限，重新启用时从当前时刻按 duration_hours 计算。保持启用的 PUT 视为续期，界面需明确提示；effectiveness 只取决于 enabled 且 expires_at 为空或晚于当前时间。读取无需更新数据库中的“已过期”状态。

创建示例：

```json
{
  "scope": "ip", "ip": "192.0.2.18", "region_id": null,
  "reason": "异常高频请求", "duration_hours": 24, "enabled": true
}
```

此处使用文档示例 IP，不是实际应封锁的目标。服务端解析 IPv4/IPv6、规范化 IPv4-mapped IPv6；首期只允许单 IP，不接受 CIDR。region_id 使用服务端目录中的稳定 ID，不把中文标签或原型 cn-shenzhen 当可信枚举。无可靠区域库时归入 unknown，区域封锁创建返回 503 REGION_LOOKUP_UNAVAILABLE，UI 禁用并解释；已有 IP 规则继续执行。

## 4. PostgreSQL 持久化

以下为 [06](06-data-storage.md) 的领域补充，对应 SQL 迁移已创建，见 backend/migrations。

| 表 | 主要字段与约束 |
| --- | --- |
| region_catalog | id text PK；label；blockable boolean；lookup_code UNIQUE；数据源及版本由部署记录；unknown 为保留 ID，blockable=false |
| visit_events | id UUID PK；event_id UUID UNIQUE；occurred_at timestamptz；visitor_hash bytea；hash_key_version；client_ip inet；region_id FK；region_label；network_label/null；page_path；page_title；content_id UUID/null FK SET NULL；source/device CHECK 枚举 |
| analytics_daily | date date PK（北京时间）；pv bigint、uv bigint；source_counts/device_counts jsonb；updated_at；只作可重算的日汇总，不用每日 UV 相加计算区间 UV |
| access_rules | id UUID PK；scope CHECK ip/region；ip inet/null；region_id FK/null；action CHECK deny；reason varchar(200)；enabled boolean；duration_hours integer/null CHECK 1/24/168；created_at、updated_at、expires_at；version int CHECK >0 |

access_rules CHECK scope=ip 时 ip 非空且 region_id 空，region 时相反；分别对非空 ip/region_id 建唯一索引，每目标一条规则，过期后更新原记录而非无限叠加。重复 POST 返回 409 RULE_CONFLICT；version 冲突为 VERSION_CONFLICT。禁用、删除和续期在事务内校验版本并写 audit_logs。规则保存成功后下一次请求即从库读到，不引入未说明的长时间缓存。

事件按 occurred_at DESC,id DESC、region_id/occurred_at、content_id/occurred_at 建索引；event_id 唯一索引用于幂等。先持久化事件，maintenance 每日从事件重算最近日期的 analytics_daily；当前 7/30 天面板直接从事件计算，避免聚合延迟及 UV 相加错误。数据量增大后再调整查询/分区策略。

事件与完整 IP 保留最近 60 个北京时间自然日（含今天），支持最近 30 天和前一 30 天环比；日汇总保留 365 天。不得只保留 30 天事件却声称支持精确的 30 天 UV 环比。maintenance 每日清理到期事件及聚合；日志保留周期另行配置。page_title 存访问时快照，内容删除后 content_id 置空，历史记录仍可显示但不生成详情链接。

数据库备份含 IP 明细，必须加密、限权，并按保留周期淘汰旧备份；恢复后先执行过期清理再开放后台。visitor_hash 不返回给公开 API，管理明细也不需要返回该值。

## 5. 封锁如何真正生效

```text
新公开文档请求 → Caddy 内部检查 → Rust access service → 规则匹配
  允许 → 返回 React 页面；拒绝 → Caddy 返回通用 403
公开 API/媒体 → Rust 同一 access service → 允许后继续业务/媒体权限检查
后台/登录 → 独立鉴权和限流 → 管理规则及误封恢复
```

公开静态文档和 sitemap 必须经内部访问检查，否则只封 API 会让 HTML 继续访问。API/媒体在 Rust 内执行同一规则；前端已下载的静态页面/资源不能被收回，公共哈希 assets 可以继续缓存，不含业务私密数据。SPA 路由切换会触发业务 GET，从响应呈现 403；浏览器缓存的旧内容无法强制抹去。

计划内部端点 `GET /internal/access-check` 仅供 Caddy 子请求使用：204 放行、403 拒绝、依赖不可用 503；不对公网代理。Caddy 必须覆盖/移除访客伪造的转发头，传入实际 TCP 客户端地址；Rust 只信任部署配置的 Caddy 地址段，并保留原请求方法/路径用于匹配。接入 CDN 后需先配置可信代理链，不能直接取任意 X-Forwarded-For 首项。

IP 命中或规范区域命中任意有效规则即拒绝；解除某 IP 不覆盖仍有效的区域规则，不提供隐含 allow 优先级。归属地库缺失/查不到时 region=unknown，IP 规则仍有效；数据库/规则服务故障公开检查返回 503，不假装规则已执行。归属地来自服务器部署的本地数据源，目录与查询库版本必须一致；不在每个请求向第三方发送访客 IP。

管理、登录、health 与内部检查路径不受业务封锁，避免自锁或递归；仍须执行自身鉴权、Origin/CSRF 和限流。规则不提供物理网络隔离或 DDoS 防护。维护 CLI 追加 `access-rule-disable <id>`，受服务器操作权限保护，事务更新 version 并记录恢复操作；实现后才提供可执行命令。

## 6. 验收边界

使用固定事件集验证跨日同一访客的范围 UV、event_id 去重、来源/设备汇总、日期补零和环比空基数。使用真实 HTTP 请求验证静态入口/API/媒体均被规则拒绝，区域未知和服务故障路径正确；解除 IP 后区域规则仍命中。具体场景见 [09](09-implementation-and-testing.md)。现有原型徽标或本地规则列表不能作为验收依据。
