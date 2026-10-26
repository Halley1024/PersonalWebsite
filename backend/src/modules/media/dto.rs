use serde::Deserialize;
#[derive(Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MediaQuery {
    pub variant: Option<String>, // 原图 original 或缩略图 thumb。
} // 只允许 original 或 thumb。
#[derive(Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MediaListQuery {
    pub page: Option<i64>,      // 页码，从 1 开始。
    pub page_size: Option<i64>, // 每页条数。
    pub unused: Option<bool>,   // 只查询未被引用的媒体。
} // 管理媒体筛选。
