use sqlx::FromRow;
#[derive(FromRow)]
pub struct RuleIdentity {
    pub scope: String,             // 规则目标类型：IP 或区域。
    pub ip: Option<String>,        // 单个规范化 IP 地址。
    pub region_id: Option<String>, // 规范区域目录 ID。
    pub version: i32,              // 预期版本或当前乐观锁版本。
} // 写事务锁定的规则目标。
