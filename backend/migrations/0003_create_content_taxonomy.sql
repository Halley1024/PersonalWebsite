-- 内容分类：每种内容类型独立维护 slug，复合唯一键供类型一致性外键使用。
CREATE TABLE categories (
    -- 记录主键；UUID 由应用生成。
    id UUID PRIMARY KEY,
    -- 内容类型；创建后由服务层禁止修改。
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('blog', 'project', 'life')),
    name VARCHAR(50) NOT NULL CHECK (char_length(btrim(name)) > 0),
    -- URL 标识；小写字母、数字和单个连字符分段，同类型内唯一。
    slug VARCHAR(100) NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    sort_order INTEGER NOT NULL DEFAULT 0,
    -- 乐观锁版本：业务更新须校验旧值并原子递增。
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    -- 创建时间，使用带时区时间戳记录绝对时刻。
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 最近更新时间；后续 UPDATE 语句必须显式维护。
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (kind, slug),
    UNIQUE (id, kind)
);

-- 内容标签：博客、作品、生活之间不能交叉绑定标签。
CREATE TABLE tags (
    -- 记录主键；UUID 由应用生成。
    id UUID PRIMARY KEY,
    -- 内容类型；创建后由服务层禁止修改。
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('blog', 'project', 'life')),
    name VARCHAR(50) NOT NULL CHECK (char_length(btrim(name)) > 0),
    -- URL 标识；小写字母、数字和单个连字符分段，同类型内唯一。
    slug VARCHAR(100) NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    -- 乐观锁版本：业务更新须校验旧值并原子递增。
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    -- 创建时间，使用带时区时间戳记录绝对时刻。
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 最近更新时间；后续 UPDATE 语句必须显式维护。
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (kind, slug),
    UNIQUE (id, kind)
);

-- 统一内容主表：三种内容共用草稿、发布、归档状态及乐观锁版本。
CREATE TABLE content_items (
    -- 记录主键；UUID 由应用生成。
    id UUID PRIMARY KEY,
    -- 内容类型；创建后由服务层禁止修改。
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('blog', 'project', 'life')),
    title VARCHAR(120) NOT NULL CHECK (char_length(btrim(title)) > 0),
    -- URL 标识；小写字母、数字和单个连字符分段，同类型内唯一。
    slug VARCHAR(100) NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    excerpt VARCHAR(300) NOT NULL CHECK (char_length(btrim(excerpt)) > 0),
    -- Markdown 原文；图片引用由后端解析和维护。
    body_markdown TEXT NOT NULL DEFAULT '' CHECK (char_length(body_markdown) <= 200000),
    -- 内容状态转换及发布校验由业务服务在事务内完成。
    status VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    -- 封面引用；任何状态的内容引用都阻止媒体删除。
    cover_media_id UUID REFERENCES media_files(id) ON DELETE RESTRICT,
    -- 与 kind 共同建立外键，禁止跨类型绑定分类。
    category_id UUID,
    featured BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    seo_title VARCHAR(70) CHECK (seo_title IS NULL OR char_length(btrim(seo_title)) > 0),
    seo_description VARCHAR(160) CHECK (seo_description IS NULL OR char_length(btrim(seo_description)) > 0),
    -- 首次发布时间；已发布内容必须有值，后续更新保持原值。
    published_at TIMESTAMPTZ,
    -- 创建时间，使用带时区时间戳记录绝对时刻。
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 最近更新时间；后续 UPDATE 语句必须显式维护。
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- 乐观锁版本：业务更新须校验旧值并原子递增。
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (kind, slug),
    UNIQUE (id, kind),
    FOREIGN KEY (category_id, kind) REFERENCES categories(id, kind) ON DELETE RESTRICT,
    CHECK (status <> 'published' OR published_at IS NOT NULL)
);

-- 作品扩展：复合外键保证只能依附 project，内容删除时一起删除。
CREATE TABLE project_details (
    -- 关联统一内容主表。
    content_id UUID PRIMARY KEY,
    -- 内容类型；创建后由服务层禁止修改。
    kind VARCHAR(16) NOT NULL DEFAULT 'project' CHECK (kind = 'project'),
    -- 项目开始日期。
    started_on DATE NOT NULL,
    -- 结束日期，空值表示至今，不得早于开始日期。
    ended_on DATE CHECK (ended_on IS NULL OR ended_on >= started_on),
    -- 技术栈字符串数组；元素校验由服务层负责。
    tech_stack JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(tech_stack) = 'array'),
    repository_url TEXT CHECK (repository_url IS NULL OR (char_length(repository_url) <= 2048 AND repository_url ~ '^https://')),
    demo_url TEXT CHECK (demo_url IS NULL OR (char_length(demo_url) <= 2048 AND demo_url ~ '^https://')),
    -- 项目阶段白名单。
    project_stage VARCHAR(16) NOT NULL DEFAULT 'building' CHECK (project_stage IN ('idea', 'building', 'maintained', 'completed')),
    FOREIGN KEY (content_id, kind) REFERENCES content_items(id, kind) ON DELETE CASCADE
);

-- 生活扩展：记录真实发生日期，复合外键禁止绑定其他内容类型。
CREATE TABLE life_details (
    -- 关联统一内容主表。
    content_id UUID PRIMARY KEY,
    -- 内容类型；创建后由服务层禁止修改。
    kind VARCHAR(16) NOT NULL DEFAULT 'life' CHECK (kind = 'life'),
    -- 生活内容发生日期，不使用时间戳冒充日期。
    occurred_on DATE NOT NULL,
    location_label VARCHAR(100),
    FOREIGN KEY (content_id, kind) REFERENCES content_items(id, kind) ON DELETE CASCADE
);

-- 内容与标签关系：两端的复合外键共同保证 kind 一致。
CREATE TABLE content_tags (
    -- 关联统一内容主表。
    content_id UUID NOT NULL,
    tag_id UUID NOT NULL,
    -- 内容类型；创建后由服务层禁止修改。
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('blog', 'project', 'life')),
    PRIMARY KEY (content_id, tag_id),
    FOREIGN KEY (content_id, kind) REFERENCES content_items(id, kind) ON DELETE CASCADE,
    FOREIGN KEY (tag_id, kind) REFERENCES tags(id, kind) ON DELETE RESTRICT
);

-- 正文/相册引用：封面和头像分别保存在主表及资料表，不重复计数。
CREATE TABLE content_media (
    -- 关联统一内容主表。
    content_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES media_files(id) ON DELETE RESTRICT,
    -- 引用用途：正文 body 或相册 gallery。
    role VARCHAR(16) NOT NULL CHECK (role IN ('body', 'gallery')),
    -- 相册中的非负位置，同一内容内不能重复；连续性由服务层保证。
    position INTEGER,
    -- 图片替代文本；正文引用的替代文本保留在 Markdown 中。
    alt VARCHAR(200),
    PRIMARY KEY (content_id, media_id, role),
    CHECK ((role = 'body' AND position IS NULL AND alt IS NULL)
        OR (role = 'gallery' AND position IS NOT NULL AND position >= 0 AND alt IS NOT NULL))
);

-- 同一内容的相册位置不能重复，连续位置由 service 校验。
CREATE UNIQUE INDEX content_media_gallery_position_unique
    ON content_media(content_id, position) WHERE role = 'gallery';
