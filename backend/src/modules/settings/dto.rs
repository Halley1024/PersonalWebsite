use serde::{Deserialize, Serialize};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SettingsInput {
    pub site_name: String,                       // 站点名称。
    pub site_description: String,                // 站点描述。
    pub footer_text: String,                     // 页脚文案。
    pub default_seo_title: Option<String>,       // 可清空的 SEO 标题。
    pub default_seo_description: Option<String>, // 可清空的 SEO 描述。
    pub version: i32,                            // 预期旧版本。
}

/// 公开设置响应，不包含数据库版本和更新时间。
#[derive(Serialize)]
pub struct PublicSettingsDto {
    pub site_name: String,                       // 站点名称。
    pub site_description: String,                // 站点描述。
    pub footer_text: String,                     // 页脚文案。
    pub default_seo_title: Option<String>,       // 默认 SEO 标题。
    pub default_seo_description: Option<String>, // 默认 SEO 描述。
}
impl From<super::model::Settings> for PublicSettingsDto {
    fn from(v: super::model::Settings) -> Self {
        Self {
            site_name: v.site_name,
            site_description: v.site_description,
            footer_text: v.footer_text,
            default_seo_title: v.default_seo_title,
            default_seo_description: v.default_seo_description,
        }
    }
}
