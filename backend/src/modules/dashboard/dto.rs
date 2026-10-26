use serde::Serialize;
#[derive(Serialize)]
pub struct ContentCount {
    pub kind: String,   // 内容类型：blog、project 或 life。
    pub status: String, // 业务状态。
    pub count: i64,     // 真实查询得到的数量。
} // 内容数量，不是访客流量。

impl From<crate::modules::content::model::ContentCount> for ContentCount {
    fn from(v: crate::modules::content::model::ContentCount) -> Self {
        Self {
            kind: v.kind,
            status: v.status,
            count: v.count,
        }
    }
}
