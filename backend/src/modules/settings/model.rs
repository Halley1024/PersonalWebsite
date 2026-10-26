use chrono::{DateTime, Utc};
use sqlx::FromRow;
#[derive(FromRow)]
pub struct Settings {
    pub site_name: String,                       // 站点名称。
    pub site_description: String,                // 站点描述。
    pub footer_text: String,                     // 页脚文字。
    pub default_seo_title: Option<String>,       // 默认 SEO 标题。
    pub default_seo_description: Option<String>, // 默认 SEO 描述。
    pub version: i32,                            // 预期版本或当前乐观锁版本。
    pub updated_at: DateTime<Utc>,               // 最近更新时间。
} // 单例站点设置。
