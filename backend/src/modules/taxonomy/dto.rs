use serde::Deserialize;
#[derive(Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TaxonomyQuery {
    pub kind: Option<String>,   // 内容类型：blog、project 或 life。
    pub page: Option<i64>,      // 页码，从 1 开始。
    pub page_size: Option<i64>, // 每页条数。
} // 管理列表分页，公开列表只接受 kind。
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct KindQuery {
    pub kind: String, // 内容类型：blog、project 或 life。
} // 公开分类/标签必须指定内容类型。
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct VersionQuery {
    pub version: i32, // 预期版本或当前乐观锁版本。
} // 删除操作的乐观锁版本。
