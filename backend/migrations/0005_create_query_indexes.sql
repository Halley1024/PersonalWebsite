-- 会话验证与两种到期时间清理。
CREATE INDEX admin_sessions_admin_id_idx ON admin_sessions(admin_id);
CREATE INDEX admin_sessions_expires_at_idx ON admin_sessions(expires_at);
CREATE INDEX admin_sessions_absolute_expires_at_idx ON admin_sessions(absolute_expires_at);
-- 媒体引用查找：删除媒体前检查所有引用，不维护可漂移的引用计数。
CREATE INDEX site_profile_avatar_media_id_idx ON site_profile(avatar_media_id) WHERE avatar_media_id IS NOT NULL;
-- 公开列表只查已发布内容；作品优先按 sort_order 排序。
CREATE INDEX content_items_public_idx ON content_items(kind, published_at DESC, id DESC) WHERE status = 'published';
CREATE INDEX content_items_public_projects_idx ON content_items(sort_order, published_at DESC, id DESC) WHERE kind = 'project' AND status = 'published';
-- 后台列表和分类/媒体外键查找。
CREATE INDEX content_items_admin_idx ON content_items(kind, status, updated_at DESC, id DESC);
CREATE INDEX content_items_cover_media_id_idx ON content_items(cover_media_id) WHERE cover_media_id IS NOT NULL;
CREATE INDEX content_items_category_kind_idx ON content_items(category_id, kind) WHERE category_id IS NOT NULL;
-- 生活按发生日期排序；标签、图片按反向引用查找。
CREATE INDEX life_details_occurred_on_idx ON life_details(occurred_on DESC, content_id DESC);
CREATE INDEX content_tags_tag_content_idx ON content_tags(tag_id, content_id);
CREATE INDEX content_media_media_content_idx ON content_media(media_id, content_id);
-- 审计按时间清理，按管理员查找。
CREATE INDEX audit_logs_created_at_idx ON audit_logs(created_at DESC);
CREATE INDEX audit_logs_admin_id_idx ON audit_logs(admin_id) WHERE admin_id IS NOT NULL;
-- 访问明细、时间范围统计及跨日 UV 查询。
CREATE INDEX visit_events_occurred_at_idx ON visit_events(occurred_at DESC, id DESC);
CREATE INDEX visit_events_region_occurred_at_idx ON visit_events(region_id, occurred_at DESC);
CREATE INDEX visit_events_content_occurred_at_idx ON visit_events(content_id, occurred_at DESC);
CREATE INDEX visit_events_visitor_occurred_at_idx ON visit_events(visitor_hash, occurred_at DESC);
-- 管理规则列表采用创建时间与 ID 的稳定排序。
CREATE INDEX access_rules_created_at_idx ON access_rules(created_at DESC, id DESC);
