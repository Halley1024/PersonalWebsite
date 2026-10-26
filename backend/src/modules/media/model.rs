use sqlx::FromRow;
#[derive(FromRow)]
pub struct Media {
    pub storage_key: String,   // 原图的私有存储键。
    pub thumbnail_key: String, // 缩略图的私有存储键。
    pub mime_type: String,     // 原图 MIME 类型。
    pub state: String,         // ready 或 deleting。
}

pub struct NewMedia<'a> {
    pub id: uuid::Uuid,     // 记录标识。
    pub original: &'a str,  // 原图相对存储键或重编码内容。
    pub thumbnail: &'a str, // 缩略图相对存储键或重编码内容。
    pub byte_size: i64,     // 保存文件的字节数。
    pub width: i32,         // 图像宽度，单位像素。
    pub height: i32,        // 图像高度，单位像素。
    pub alt: &'a str,       // 图片替代文本。
    pub sha256: Vec<u8>,    // 保存后文件的 SHA-256 摘要。
} // 服务层准备的入库元数据。
