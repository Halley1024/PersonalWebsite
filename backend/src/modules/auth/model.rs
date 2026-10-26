use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;
#[derive(FromRow)]
pub struct Admin {
    pub id: Uuid,              // 记录标识。
    pub username: String,      // 管理员登录名。
    pub password_hash: String, // 密码散列，不返回客户端。
} // 内部账号模型，不序列化散列。
#[derive(Clone, FromRow)]
pub struct Session {
    pub id: Uuid,                  // 记录标识。
    pub admin_id: Uuid,            // 关联管理员身份。
    pub username: String,          // 管理员登录名。
    pub csrf_token: String,        // 当前会话的 CSRF token。
    pub expires_at: DateTime<Utc>, // 到期时间。
} // 当前请求身份。
#[derive(Serialize)]
pub struct AdminIdentity {
    pub id: Uuid,         // 记录标识。
    pub username: String, // 管理员登录名。
} // 对外只暴露身份字段。

/// 新会话的持久化输入，只在服务内部使用。
pub struct NewSession {
    pub id: Uuid,                           // 内部会话主键。
    pub admin_id: Uuid,                     // 管理员身份。
    pub token_hash: Vec<u8>,                // 会话 token 摘要。
    pub csrf_token: String,                 // 当前会话 CSRF token。
    pub created_at: DateTime<Utc>,          // 创建时刻。
    pub expires_at: DateTime<Utc>,          // 闲置到期时间。
    pub absolute_expires_at: DateTime<Utc>, // 不可滑动的绝对期限。
}
