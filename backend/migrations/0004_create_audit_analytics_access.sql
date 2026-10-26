-- 管理写入审计：应与业务修改在同一事务写入；不存秘密或正文副本。
CREATE TABLE audit_logs (
    -- 记录主键；UUID 由应用生成。
    id UUID PRIMARY KEY,
    -- 服务器恢复命令可在没有登录会话时执行，因此允许空管理员 ID。
    admin_id UUID REFERENCES admins(id) ON DELETE RESTRICT,
    -- 首期只允许 deny。
    action VARCHAR(64) NOT NULL CHECK (char_length(btrim(action)) > 0),
    resource_type VARCHAR(64) NOT NULL CHECK (char_length(btrim(resource_type)) > 0),
    -- 目标既可能是 UUID，也可能是单例资料/设置的整数 ID。
    resource_id TEXT NOT NULL CHECK (char_length(resource_id) > 0),
    -- HTTP 请求关联标识；服务器 CLI 操作可为空。
    request_id TEXT,
    -- 创建时间，使用带时区时间戳记录绝对时刻。
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 只记录变更字段名和状态等最少信息，不保存敏感数据。
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(metadata) = 'object')
);

-- 规范区域目录：只初始化 unknown；真实目录由归属地数据源导入。
CREATE TABLE region_catalog (
    -- 记录主键；UUID 由应用生成。
    id TEXT PRIMARY KEY CHECK (char_length(id) > 0),
    label VARCHAR(100) NOT NULL CHECK (char_length(btrim(label)) > 0),
    -- 区域是否允许封锁；unknown 必须为 false。
    blockable BOOLEAN NOT NULL,
    -- 本地归属地数据源的匹配编码；unknown 可为空。
    lookup_code TEXT UNIQUE,
    CHECK (id <> 'unknown' OR blockable = false)
);

-- 未部署真实归属地数据源前，不伪造可封锁的区域目录。
INSERT INTO region_catalog (id, label, blockable) VALUES ('unknown', '未知区域', false);

-- 页面浏览事件：event_id 幂等；标题/区域是当时快照，内容删除后保留事件。
CREATE TABLE visit_events (
    -- 记录主键；UUID 由应用生成。
    id UUID PRIMARY KEY,
    -- 客户端一次页面浏览的 UUID，唯一约束防止重试重复计数。
    event_id UUID NOT NULL UNIQUE,
    -- 服务端接收时间，不能由客户端指定。
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 访客随机 Cookie 的 HMAC，不是 IP，不向接口返回。
    visitor_hash BYTEA NOT NULL CHECK (octet_length(visitor_hash) > 0),
    -- HMAC 密钥版本，轮换后不能假设身份仍可直接合并。
    hash_key_version INTEGER NOT NULL CHECK (hash_key_version > 0),
    -- 服务端从可信代理链取得的单个 IPv4/IPv6 地址，不允许 CIDR。
    client_ip INET NOT NULL CHECK (masklen(client_ip) = CASE family(client_ip) WHEN 4 THEN 32 ELSE 128 END),
    region_id TEXT NOT NULL REFERENCES region_catalog(id) ON DELETE RESTRICT,
    -- 事件发生时的区域标签快照。
    region_label VARCHAR(100) NOT NULL,
    -- 运营商等展示信息，未知可为空。
    network_label VARCHAR(200),
    -- 规范公开页面路径；具体白名单及发布状态由服务层检查。
    page_path VARCHAR(300) NOT NULL CHECK (page_path LIKE '/%'),
    -- 访问时的标题快照，内容删除后仍可展示。
    page_title VARCHAR(300) NOT NULL,
    -- 关联统一内容主表。
    content_id UUID REFERENCES content_items(id) ON DELETE SET NULL,
    -- 服务端归类的来源枚举，不保存完整带查询串的来源 URL。
    source VARCHAR(16) NOT NULL CHECK (source IN ('direct', 'github', 'search', 'bilibili', 'other')),
    -- 服务端归类的设备类型，不长期保存原始 User-Agent。
    device VARCHAR(16) NOT NULL CHECK (device IN ('desktop', 'mobile', 'tablet', 'unknown'))
);

-- 可重算日汇总：日期按北京时间解释，当前面板仍从原始事件计算。
CREATE TABLE analytics_daily (
    -- Asia/Shanghai 自然日。
    date DATE PRIMARY KEY,
    -- 当日页面浏览事件数，非负。
    pv BIGINT NOT NULL DEFAULT 0 CHECK (pv >= 0),
    -- 当日访客去重数，不得大于 PV；不能跨天直接相加。
    uv BIGINT NOT NULL DEFAULT 0 CHECK (uv >= 0 AND uv <= pv),
    -- 按来源计数的对象，由维护任务重算。
    source_counts JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(source_counts) = 'object'),
    -- 按设备计数的对象，由维护任务重算。
    device_counts JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(device_counts) = 'object'),
    -- 最近更新时间；后续 UPDATE 语句必须显式维护。
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON COLUMN analytics_daily.date IS 'Asia/Shanghai 自然日；区间 UV 不能由每日 UV 求和';

-- 访问拒绝规则：有效性由 enabled 与 expires_at 动态计算，不存过期状态。
CREATE TABLE access_rules (
    -- 记录主键；UUID 由应用生成。
    id UUID PRIMARY KEY,
    -- 目标是单 IP 或规范区域，两类目标字段必须互斥。
    scope VARCHAR(16) NOT NULL CHECK (scope IN ('ip', 'region')),
    -- 只允许完整主机地址；IPv4-mapped IPv6 的归一化由服务层完成。
    ip INET,
    region_id TEXT REFERENCES region_catalog(id) ON DELETE RESTRICT,
    -- 首期只允许 deny。
    action VARCHAR(16) NOT NULL DEFAULT 'deny' CHECK (action = 'deny'),
    reason VARCHAR(200) NOT NULL CHECK (char_length(btrim(reason)) > 0),
    enabled BOOLEAN NOT NULL DEFAULT true,
    -- 期限策略：1、24、168 小时或永久；禁用不自动延长期限。
    duration_hours INTEGER CHECK (duration_hours IN (1, 24, 168)),
    -- 创建时间，使用带时区时间戳记录绝对时刻。
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 最近更新时间；后续 UPDATE 语句必须显式维护。
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 到期时间；会话不可超过绝对期限，规则为空表示永久。
    expires_at TIMESTAMPTZ,
    -- 乐观锁版本：业务更新须校验旧值并原子递增。
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    CHECK ((scope = 'ip' AND ip IS NOT NULL AND region_id IS NULL)
        OR (scope = 'region' AND ip IS NULL AND region_id IS NOT NULL)),
    CHECK (ip IS NULL OR masklen(ip) = CASE family(ip) WHEN 4 THEN 32 ELSE 128 END),
    CHECK (region_id IS NULL OR region_id <> 'unknown'),
    CHECK ((duration_hours IS NULL) = (expires_at IS NULL))
);

-- 包括过期/禁用规则，每目标也只能有一条记录。
CREATE UNIQUE INDEX access_rules_ip_unique ON access_rules(ip) WHERE ip IS NOT NULL;
CREATE UNIQUE INDEX access_rules_region_unique ON access_rules(region_id) WHERE region_id IS NOT NULL;
