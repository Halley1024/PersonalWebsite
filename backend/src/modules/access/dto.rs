use serde::Deserialize;
#[derive(Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RulesQuery {
    pub scope: Option<String>,  // 规则目标类型：IP 或区域。
    pub state: Option<String>,  // 规则筛选状态。
    pub q: Option<String>,      // 字面子串搜索关键词。
    pub page: Option<i64>,      // 页码，从 1 开始。
    pub page_size: Option<i64>, // 每页条数。
} // 规则查询白名单。
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RuleInput {
    pub scope: String,               // 规则目标类型：IP 或区域。
    pub ip: Option<String>,          // 单个规范化 IP 地址。
    pub region_id: Option<String>,   // 规范区域目录 ID。
    pub reason: String,              // 操作或封锁原因。
    pub enabled: bool,               // 是否启用规则。
    pub duration_hours: Option<i32>, // 规则期限小时数；空值表示永久。
    pub version: Option<i32>,        // 预期版本或当前乐观锁版本。
} // scope 和目标创建后不可修改。
