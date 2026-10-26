CREATE TABLE site_settings (
    -- 单例表：只允许一条 id=1 的记录。
    id SMALLINT PRIMARY KEY CHECK (id = 1),

    site_name VARCHAR(80) NOT NULL,
    site_description VARCHAR(300) NOT NULL DEFAULT '',
    footer_text VARCHAR(300) NOT NULL DEFAULT '',

    default_seo_title VARCHAR(70),
    default_seo_description VARCHAR(160),

    -- 后续用于检测并发更新冲突。
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT site_settings_name_not_blank
        CHECK (char_length(btrim(site_name)) > 0),

    CONSTRAINT site_settings_seo_title_not_blank
        CHECK (
            default_seo_title IS NULL
            OR char_length(btrim(default_seo_title)) > 0
        ),

    CONSTRAINT site_settings_seo_description_not_blank
        CHECK (
            default_seo_description IS NULL
            OR char_length(btrim(default_seo_description)) > 0
        )
);

INSERT INTO site_settings (id, site_name)
VALUES (1, '个人网站');