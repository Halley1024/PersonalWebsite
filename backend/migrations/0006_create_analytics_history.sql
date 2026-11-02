-- Annual analytics retain no IP, region, network, title, or page path.
-- A visitor hash is pseudonymous, retained for at most 730 days to deduplicate UV.
CREATE TABLE analytics_history (
    event_id uuid PRIMARY KEY,
    occurred_at timestamptz NOT NULL,
    visitor_hash bytea NOT NULL,
    content_id uuid REFERENCES content_items(id) ON DELETE SET NULL,
    source text NOT NULL,
    device text NOT NULL
);
CREATE INDEX analytics_history_occurred_at ON analytics_history(occurred_at);
COMMENT ON TABLE analytics_history IS '不含 IP 的年度统计事件；维护任务保留 730 个北京时间自然日，支持年度与前期 UV 去重';

-- Archiving and raw-event deletion share one transaction; each event appears once.
CREATE VIEW analytics_events AS
SELECT event_id,occurred_at,visitor_hash,content_id,source,device FROM visit_events
UNION ALL
SELECT event_id,occurred_at,visitor_hash,content_id,source,device FROM analytics_history;
