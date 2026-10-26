use uuid::Uuid;

/// 同一业务事务内写入的最小审计记录，不包含正文或秘密。
pub struct AuditEntry<'a> {
    pub id: Uuid,                   // 审计记录主键。
    pub admin_id: Option<Uuid>,     // CLI 恢复操作可以没有登录身份。
    pub action: &'a str,            // 稳定的操作名称。
    pub resource_type: &'a str,     // 被操作的资源类型。
    pub resource_id: &'a str,       // UUID 或单例资源 ID。
    pub request_id: Option<String>, // HTTP 请求 ID，CLI 可为空。
}
