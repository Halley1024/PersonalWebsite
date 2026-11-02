-- 内容支持多个分类，保留 category_id 作为旧接口兼容的首个分类。
CREATE TABLE content_categories (
    content_id UUID NOT NULL,
    category_id UUID NOT NULL,
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('blog', 'project', 'life')),
    position INTEGER NOT NULL CHECK (position >= 0),
    PRIMARY KEY (content_id, category_id),
    UNIQUE (content_id, position),
    FOREIGN KEY (content_id, kind) REFERENCES content_items(id, kind) ON DELETE CASCADE,
    FOREIGN KEY (category_id, kind) REFERENCES categories(id, kind) ON DELETE RESTRICT
);
CREATE INDEX content_categories_category_lookup ON content_categories(category_id, content_id);

-- 原有文章的单个分类迁移为一个已选项，不改变内容版本和发布时间。
INSERT INTO content_categories(content_id, category_id, kind, position)
SELECT id, category_id, kind, 0 FROM content_items WHERE category_id IS NOT NULL;
