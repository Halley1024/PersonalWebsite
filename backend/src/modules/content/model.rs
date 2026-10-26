use sqlx::FromRow;
#[derive(FromRow)]
pub struct ContentIdentity {
    pub kind: String,   // 内容类型：blog、project 或 life。
    pub status: String, // 业务状态。
    pub version: i32,   // 预期版本或当前乐观锁版本。
} // 写入事务内锁定的内容身份。

#[derive(sqlx::FromRow)]
pub struct GalleryRow {
    pub media_id: uuid::Uuid,             // 相册引用的媒体 ID。
    pub position: i32,                    // 相册中的顺序。
    pub alt: String,                      // 内容级替代文本。
    pub media: Option<serde_json::Value>, // 可用媒体的公开摘要。
}

#[derive(sqlx::FromRow)]
pub struct ContentCount {
    pub kind: String,   // 内容类型。
    pub status: String, // 业务状态。
    pub count: i64,     // 真实查询得到的内容数量。
} // 内容模块提供的只读统计模型。
