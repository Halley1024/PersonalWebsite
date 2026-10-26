use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, types::Json};
use uuid::Uuid;

#[derive(Debug, FromRow)]
pub struct Profile {
    pub id: i16,                             // 单例主键，数据库约束为 1。
    pub display_name: String,                // 展示名称。
    pub headline: String,                    // 简短身份或方向描述。
    pub intro: String,                       // 首页介绍。
    pub stats: Json<ProfileStats>,           // 站主填写的展示文案，不是自动计算的统计数据。
    pub bio_markdown: String,                // Markdown 格式的个人介绍正文。
    pub avatar_media_id: Option<Uuid>,       // 头像媒体 ID；没有头像时为 None。
    pub location_label: Option<String>,      // 地区展示文字。
    pub public_email: Option<String>,        // 公开联系方式。
    pub social_links: Json<Vec<SocialLink>>, // 社交链接，数组顺序就是展示顺序。
    pub skill_groups: Json<Vec<SkillGroup>>, // 技能分组，保留分组和组内条目的顺序。
    pub experiences: Json<Vec<Experience>>,  // 个人经历，按数组顺序展示。
    pub version: i32,                        // 乐观锁版本，后续用于检测并发保存冲突。
    pub updated_at: DateTime<Utc>,           // 最近更新时间。
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ProfileStats {
    pub experience: String, // 经验展示文案，不自动计算。
    pub projects: String,   // 项目数量。
    pub notes: String,      // 笔记数量。
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SocialLink {
    pub label: String, // 链接显示名称。
    pub url: String,   // 链接地址；协议是否合法由 service 校验。
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SkillGroup {
    pub title: String,      // 分组标题
    pub items: Vec<String>, // 当前分组的技能条目
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Experience {
    pub id: String,               // 经历条目的稳定标识，编辑和排序时保持不变。
    pub title: String,            // 职位、角色或经历标题。
    pub organization: String,     // 所属组织。
    pub start_date: String,       // 开始日期，格式为 YYYY-MM。
    pub end_date: Option<String>, // 结束日期；None 表示至今。
    pub description: String,      // 经历描述。
}

/// 个人资料查询需要的头像元数据。
#[derive(Debug, FromRow)]
pub struct ProfileAvatar {
    pub id: Uuid,    // 媒体记录 ID。
    pub width: i32,  // 图片宽度，单位像素。
    pub height: i32, // 图片高度，单位像素。
    pub alt: String, // 图片替代文本。
}
