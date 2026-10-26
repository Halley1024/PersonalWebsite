-- UUID 由应用生成；此迁移不创建默认管理员或密码。
-- 单管理员账号：singleton_key 限制最多一个账号；不预置密码。
CREATE TABLE admins (
    -- 记录主键；UUID 由应用生成。
    id UUID PRIMARY KEY,
    -- 固定为 1，并使用唯一约束限制单管理员。
    singleton_key SMALLINT NOT NULL DEFAULT 1 UNIQUE CHECK (singleton_key = 1),
    -- 登录名统一小写；密码散列算法由管理员创建服务负责。
    username VARCHAR(64) NOT NULL UNIQUE CHECK (username = lower(username) AND char_length(btrim(username)) > 0),
    -- 保存 Argon2id PHC 格式的散列，不保存明文密码。
    password_hash TEXT NOT NULL CHECK (char_length(password_hash) > 0),
    -- 创建时间，使用带时区时间戳记录绝对时刻。
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 最近更新时间；后续 UPDATE 语句必须显式维护。
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 管理员会话：仅保存随机会话 token 的摘要，不保存明文 token。
CREATE TABLE admin_sessions (
    -- 记录主键；UUID 由应用生成。
    id UUID PRIMARY KEY,
    -- 关联管理员；会话随账号删除，审计记录禁止级联删除。
    admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    -- 会话 token 的 SHA-256 摘要，固定 32 字节且唯一。
    token_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
    -- 与当前会话关联的 CSRF token，不能单独用于身份认证。
    csrf_token TEXT NOT NULL CHECK (char_length(csrf_token) > 0),
    -- 创建时间，使用带时区时间戳记录绝对时刻。
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 最近活动时间，由会话服务按节流策略更新。
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 到期时间；会话不可超过绝对期限，规则为空表示永久。
    expires_at TIMESTAMPTZ NOT NULL,
    -- 会话绝对到期时间，不随活动顺延。
    absolute_expires_at TIMESTAMPTZ NOT NULL,
    CHECK (created_at <= last_seen_at),
    CHECK (last_seen_at <= expires_at AND expires_at <= absolute_expires_at)
);

-- 媒体元数据：只保存相对存储键，图片文件位于私有媒体卷。
CREATE TABLE media_files (
    -- 记录主键；UUID 由应用生成。
    id UUID PRIMARY KEY,
    -- 原图的相对存储路径；路径安全由存储层校验。
    storage_key TEXT NOT NULL UNIQUE CHECK (char_length(storage_key) > 0),
    -- 缩略图的相对存储路径，不向公开 DTO 暴露。
    thumbnail_key TEXT NOT NULL UNIQUE CHECK (char_length(thumbnail_key) > 0),
    -- 只允许经过后端验证和重编码的 JPEG、PNG、WebP。
    mime_type VARCHAR(32) NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
    -- 保存后的文件字节数，必须大于 0。
    byte_size BIGINT NOT NULL CHECK (byte_size > 0),
    -- 保存后图像宽度，单位像素。
    width INTEGER NOT NULL CHECK (width > 0 AND width <= 12000),
    -- 保存后图像高度；另校验总像素上限。
    height INTEGER NOT NULL CHECK (height > 0 AND height <= 12000),
    -- 图片替代文本；正文引用的替代文本保留在 Markdown 中。
    alt VARCHAR(200) NOT NULL DEFAULT '',
    -- 保存后文件的 SHA-256，用于完整性检查，不用于自动去重。
    sha256 BYTEA NOT NULL CHECK (octet_length(sha256) = 32),
    -- ready 可使用，deleting 等待删除/重试；可见性仍由引用与身份决定。
    state VARCHAR(16) NOT NULL DEFAULT 'ready' CHECK (state IN ('ready', 'deleting')),
    -- 创建时间，使用带时区时间戳记录绝对时刻。
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (width::BIGINT * height <= 40000000)
);

-- 公开个人资料单例：有序集合用 JSONB 保存，元素细节由服务层校验。
CREATE TABLE site_profile (
    -- 记录主键；UUID 由应用生成。
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    display_name VARCHAR(80) NOT NULL CHECK (char_length(btrim(display_name)) > 0),
    headline VARCHAR(160) NOT NULL DEFAULT '',
    intro VARCHAR(300) NOT NULL DEFAULT '',
    -- 展示文案对象，不是从真实业务或流量推导出的计数。
    stats JSONB NOT NULL DEFAULT '{"experience":"","projects":"","notes":""}'::JSONB CHECK (jsonb_typeof(stats) = 'object'),
    bio_markdown TEXT NOT NULL DEFAULT '' CHECK (char_length(bio_markdown) <= 20000),
    -- 头像引用；被引用的媒体不能直接删除。
    avatar_media_id UUID REFERENCES media_files(id) ON DELETE RESTRICT,
    location_label VARCHAR(100),
    public_email VARCHAR(254),
    -- 按展示顺序保存的社交链接数组。
    social_links JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(social_links) = 'array'),
    -- 有序技能分组数组，元素数量和字段由服务层校验。
    skill_groups JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(skill_groups) = 'array'),
    -- 有序经历数组；月份用 YYYY-MM 字符串，不能伪造具体日期。
    experiences JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(experiences) = 'array'),
    -- 乐观锁版本：业务更新须校验旧值并原子递增。
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    -- 最近更新时间；后续 UPDATE 语句必须显式维护。
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO site_profile (id, display_name) VALUES (1, '站主');
