-- Each content item owns its cover description; shared media metadata is unchanged.
ALTER TABLE content_items ADD COLUMN cover_alt varchar(200) NOT NULL DEFAULT '';
COMMENT ON COLUMN content_items.cover_alt IS '内容级封面替代文本；为空时使用媒体原有描述';
