use chrono::NaiveDate;
use serde::Deserialize;
use uuid::Uuid;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PageviewInput {
    pub event_id: Uuid,                  // 浏览事件幂等 ID。
    pub page_path: String,               // 规范公开页面路径。
    pub referrer_origin: Option<String>, // 来源 origin，不包含查询串。
} // 只接受客户端可提交的三个字段。
#[derive(Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AnalyticsQuery {
    pub days: Option<i64>, // 统计窗口，只允许 7 或 30 天。
} // 只支持 7/30 天。
#[derive(Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct VisitsQuery {
    pub start_date: Option<NaiveDate>, // 开始日期；经历集合中表示 YYYY-MM 月份。
    pub end_date: Option<NaiveDate>,   // 结束日期；经历集合中为空表示至今。
    pub q: Option<String>,             // 字面子串搜索关键词。
    pub source: Option<String>,        // 来源分类。
    pub region_id: Option<String>,     // 规范区域目录 ID。
    pub page: Option<i64>,             // 页码，从 1 开始。
    pub page_size: Option<i64>,        // 每页条数。
} // 北京时间日期范围。
