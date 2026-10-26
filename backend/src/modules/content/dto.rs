use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ProjectInput {
    pub tech_stack: Vec<String>,        // 技术栈列表。
    pub project_stage: String,          // 项目阶段白名单。
    pub started_on: NaiveDate,          // 项目开始日期。
    pub ended_on: Option<NaiveDate>,    // 项目结束日期，空值表示至今。
    pub repository_url: Option<String>, // HTTPS 仓库地址。
    pub demo_url: Option<String>,       // HTTPS 演示地址。
} // 作品专属字段。
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct LifeInput {
    pub occurred_on: NaiveDate,         // 生活内容发生日期。
    pub location_label: Option<String>, // 自愿公开的模糊地区。
} // 生活专属字段。
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct GalleryInput {
    pub media_id: Uuid, // 关联媒体记录 ID。
    pub alt: String,    // 图片替代文本。
    pub position: i32,  // 相册位置，从 0 开始。
} // 相册引用。
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ContentInput {
    pub kind: Option<String>,            // 仅创建时提供。
    pub slug: Option<String>,            // 仅创建时提供且以后不可变。
    pub version: Option<i32>,            // 更新时必须提供。
    pub title: String,                   // 标题。
    pub excerpt: String,                 // 纯文本摘要。
    pub body_markdown: String,           // 正文原文。
    pub cover_media_id: Option<Uuid>,    // 封面引用。
    pub category_id: Option<Uuid>,       // 同类型分类。
    pub tag_ids: Vec<Uuid>,              // 同类型标签。
    pub featured: bool,                  // 精选标记，不改变发布状态。
    pub sort_order: i32,                 // 小值优先。
    pub seo_title: Option<String>,       // SEO 标题。
    pub seo_description: Option<String>, // SEO 描述。
    pub gallery: Vec<GalleryInput>,      // 有序相册。
    pub project: Option<ProjectInput>,   // 仅作品使用。
    pub life: Option<LifeInput>,         // 仅生活使用。
}
#[derive(Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PublicQuery {
    pub page: Option<i64>,        // 页码，从 1 开始。
    pub page_size: Option<i64>,   // 每页条数。
    pub q: Option<String>,        // 字面子串搜索关键词。
    pub category: Option<String>, // 分类 slug 筛选。
    pub tag: Option<String>,      // 标签 slug 筛选。
    pub featured: Option<bool>,   // 是否精选。
} // 公开筛选白名单。
#[derive(Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AdminQuery {
    pub kind: Option<String>,     // 内容类型：blog、project 或 life。
    pub status: Option<String>,   // 业务状态。
    pub q: Option<String>,        // 字面子串搜索关键词。
    pub category: Option<String>, // 分类 slug 筛选。
    pub tag: Option<String>,      // 标签 slug 筛选。
    pub page: Option<i64>,        // 页码，从 1 开始。
    pub page_size: Option<i64>,   // 每页条数。
    pub sort: Option<String>,     // 排序白名单。
} // 管理筛选白名单。
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StatusInput {
    pub status: String, // 业务状态。
    pub version: i32,   // 预期版本或当前乐观锁版本。
} // 显式状态转换。
