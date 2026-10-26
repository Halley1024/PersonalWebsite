use serde::Serialize;
use uuid::Uuid;

use crate::modules::profile::model::{
    Experience, ProfileAvatar, ProfileStats, SkillGroup, SocialLink,
};

// GET /api/v1/profile 的公开资料
#[derive(Debug, Serialize)]
pub struct PublicProfileDto {
    pub display_name: String,             // 展示名称。
    pub headline: String,                 // 简短身份或方向描述。
    pub intro: String,                    // 首页介绍。
    pub stats: ProfileStatsDto,           // 站主填写的展示文案，不是自动统计数据。
    pub bio_markdown: String,             // Markdown 格式的个人介绍正文。
    pub avatar: Option<AvatarDto>,        // 头像摘要；没有头像时返回 null。
    pub location_label: Option<String>,   // 地区展示文字。
    pub public_email: Option<String>,     // 公开联系方式。
    pub social_links: Vec<SocialLinkDto>, // 社交链接，保留展示顺序。
    pub skill_groups: Vec<SkillGroupDto>, // 技能分组，保留分组和条目顺序。
    pub experiences: Vec<ExperienceDto>,  // 个人经历，按数组顺序展示。
}

// 资料中的展示文案。
#[derive(Debug, Serialize)]
pub struct ProfileStatsDto {
    pub experience: String, // 经验展示文案，可为空字符串。
    pub projects: String,   // 项目展示文案。
    pub notes: String,      // 笔记展示文案。
}
impl From<ProfileStats> for ProfileStatsDto {
    fn from(value: ProfileStats) -> Self {
        Self {
            experience: value.experience,
            projects: value.projects,
            notes: value.notes,
        }
    }
}

// 公开头像摘要，不暴露文件存储路径。
#[derive(Debug, Serialize)]
pub struct AvatarDto {
    pub id: Uuid,    // 媒体记录 ID。
    pub url: String, // 服务端生成的同源媒体接口地址。
    pub width: i32,  // 图片宽度，单位像素。
    pub height: i32, // 图片高度，单位像素。
    pub alt: String, // 图片替代文本。
}
impl From<ProfileAvatar> for AvatarDto {
    fn from(value: ProfileAvatar) -> Self {
        Self {
            id: value.id,
            url: format!("/api/v1/media/{}", value.id),
            width: value.width,
            height: value.height,
            alt: value.alt,
        }
    }
}

// 一条社交链接。
#[derive(Debug, Serialize)]
pub struct SocialLinkDto {
    pub label: String, // 链接显示名称。
    pub url: String,   // 链接地址。
}
impl From<SocialLink> for SocialLinkDto {
    fn from(value: SocialLink) -> Self {
        Self {
            label: value.label,
            url: value.url,
        }
    }
}

// 一组技能。
#[derive(Debug, Serialize)]
pub struct SkillGroupDto {
    pub title: String,      // 分组标题。
    pub items: Vec<String>, // 当前分组的技能条目。
}
impl From<SkillGroup> for SkillGroupDto {
    fn from(value: SkillGroup) -> Self {
        Self {
            title: value.title,
            items: value.items,
        }
    }
}

// 一段个人经历。
#[derive(Debug, Serialize)]
pub struct ExperienceDto {
    pub id: Uuid,                 // 经历条目的稳定 UUID。
    pub title: String,            // 职位、角色或经历标题。
    pub organization: String,     // 所属组织。
    pub start_date: String,       // 开始月份，格式为 YYYY-MM。
    pub end_date: Option<String>, // 结束月份；null 表示至今。
    pub description: String,      // 经历描述，没有内容时返回空字符串。
}
impl TryFrom<Experience> for ExperienceDto {
    type Error = uuid::Error;

    fn try_from(value: Experience) -> Result<Self, Self::Error> {
        Ok(Self {
            id: Uuid::parse_str(&value.id)?,
            title: value.title,
            organization: value.organization,
            start_date: value.start_date,
            end_date: value.end_date,
            description: value.description,
        })
    }
}
