use chrono::{DateTime, Utc};
use uuid::Uuid;
pub struct VisitEvent {
    pub id: Uuid,                      // 记录标识。
    pub event_id: Uuid,                // 浏览事件幂等 ID。
    pub occurred_at: DateTime<Utc>,    // 服务端记录的访问时刻。
    pub visitor_hash: Vec<u8>,         // 访客随机标识的 HMAC，不返回客户端。
    pub key_version: i32,              // 访客 HMAC 密钥版本。
    pub ip: String,                    // 单个规范化 IP 地址。
    pub region_id: String,             // 规范区域目录 ID。
    pub region_label: String,          // 访问时的区域标签快照。
    pub network_label: Option<String>, // 运营商展示文字，未知可为空。
    pub page_path: String,             // 规范公开页面路径。
    pub page_title: String,            // 访问时的页面标题快照。
    pub content_id: Option<Uuid>,      // 关联内容 ID，内容删除后可为空。
    pub source: String,                // 来源分类。
    pub device: String,                // 服务端归类的设备类型。
} // 服务端补充后的入库事件。
