use super::{
    dto::{AvatarDto, ExperienceDto, PublicProfileDto, SkillGroupDto, SocialLinkDto},
    model::Profile,
    repository,
};
use crate::{
    common::validation,
    error::{AppError, AppResult},
    modules::{audit::service::record_audit_service, media::service::lock_media_service},
    state::AppState,
};
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;
async fn public_dto(pool: &PgPool, profile: Profile) -> AppResult<PublicProfileDto> {
    if profile.id != 1 {
        return Err(AppError::internal());
    }
    let avatar = match profile.avatar_media_id {
        Some(id) => repository::find_profile_avatar_repository(pool, id)
            .await?
            .map(AvatarDto::from),
        None => None,
    };
    Ok(PublicProfileDto {
        display_name: profile.display_name,
        headline: profile.headline,
        intro: profile.intro,
        stats: profile.stats.0.into(),
        bio_markdown: profile.bio_markdown,
        avatar,
        location_label: profile.location_label,
        public_email: profile.public_email,
        social_links: profile
            .social_links
            .0
            .into_iter()
            .map(SocialLinkDto::from)
            .collect(),
        skill_groups: profile
            .skill_groups
            .0
            .into_iter()
            .map(SkillGroupDto::from)
            .collect(),
        experiences: profile
            .experiences
            .0
            .into_iter()
            .map(ExperienceDto::try_from)
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| AppError::internal())?,
    })
}
pub async fn get_profile_service(pool: &PgPool) -> AppResult<PublicProfileDto> {
    let profile = repository::find_profile_repository(pool)
        .await?
        .ok_or_else(AppError::internal)?;
    public_dto(pool, profile).await
}
pub async fn get_admin_profile_service(pool: &PgPool) -> AppResult<Value> {
    let profile = repository::find_profile_repository(pool)
        .await?
        .ok_or_else(AppError::internal)?;
    let (version, updated_at, avatar_id) =
        (profile.version, profile.updated_at, profile.avatar_media_id);
    let mut dto =
        serde_json::to_value(public_dto(pool, profile).await?).map_err(|_| AppError::internal())?;
    dto["version"] = json!(version);
    dto["updated_at"] = json!(updated_at);
    dto["avatar_media_id"] = json!(avatar_id);
    Ok(dto)
}
fn month(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 7
        && b.is_ascii()
        && b[4] == b'-'
        && b[..4].iter().all(u8::is_ascii_digit)
        && b[5..].iter().all(u8::is_ascii_digit)
        && &s[..4] != "0000"
        && matches!(s[5..].parse::<u8>(), Ok(1..=12))
}
fn validate_profile(input: &Value) -> AppResult<()> {
    validation::required(
        input,
        &[
            "display_name",
            "headline",
            "intro",
            "stats",
            "bio_markdown",
            "avatar_media_id",
            "location_label",
            "public_email",
            "social_links",
            "skill_groups",
            "experiences",
            "version",
        ],
    )?;
    for (key, min, max) in [
        ("display_name", 1, 80),
        ("headline", 0, 160),
        ("intro", 0, 300),
        ("bio_markdown", 0, 20000),
    ] {
        validation::text(
            key,
            input[key].as_str().ok_or_else(AppError::bad)?,
            min,
            max,
        )?;
    }
    if !super::super::content::markdown::media_ids(
        input["bio_markdown"].as_str().unwrap_or_default(),
    )?
    .is_empty()
    {
        return Err(AppError::invalid("bio_markdown", "个人介绍不允许图片"));
    }
    for (key, max) in [("location_label", 100), ("public_email", 254)] {
        if !input[key].is_null() {
            validation::text(key, input[key].as_str().ok_or_else(AppError::bad)?, 1, max)?;
        }
    }
    if let Some(email) = input["public_email"].as_str()
        && (email.matches('@').count() != 1
            || email.starts_with('@')
            || email.ends_with('@')
            || email.chars().any(char::is_whitespace))
    {
        return Err(AppError::invalid("public_email", "邮箱格式无效"));
    }
    validation::required(&input["stats"], &["experience", "projects", "notes"])?;
    for key in ["experience", "projects", "notes"] {
        validation::text(
            "stats",
            input["stats"][key].as_str().ok_or_else(AppError::bad)?,
            0,
            20,
        )?;
    }
    let links = input["social_links"]
        .as_array()
        .filter(|x| x.len() <= 10)
        .ok_or_else(|| AppError::invalid("social_links", "最多 10 条"))?;
    for link in links {
        validation::required(link, &["label", "url"])?;
        validation::text(
            "social_links.label",
            link["label"].as_str().ok_or_else(AppError::bad)?,
            1,
            40,
        )?;
        validation::url(
            "social_links.url",
            link["url"].as_str().ok_or_else(AppError::bad)?,
            true,
        )?;
    }
    let groups = input["skill_groups"]
        .as_array()
        .filter(|x| x.len() <= 10)
        .ok_or_else(AppError::bad)?;
    for g in groups {
        validation::required(g, &["title", "items"])?;
        validation::text(
            "skill_groups.title",
            g["title"].as_str().ok_or_else(AppError::bad)?,
            1,
            50,
        )?;
        for i in g["items"]
            .as_array()
            .filter(|x| x.len() <= 20)
            .ok_or_else(AppError::bad)?
        {
            validation::text(
                "skill_groups.items",
                i.as_str().ok_or_else(AppError::bad)?,
                1,
                50,
            )?;
        }
    }
    let mut ids = std::collections::HashSet::new();
    for e in input["experiences"]
        .as_array()
        .filter(|x| x.len() <= 30)
        .ok_or_else(AppError::bad)?
    {
        validation::required(
            e,
            &[
                "id",
                "title",
                "organization",
                "start_date",
                "end_date",
                "description",
            ],
        )?;
        let id = e["id"]
            .as_str()
            .and_then(|x| Uuid::parse_str(x).ok())
            .ok_or_else(|| AppError::invalid("experiences.id", "必须为 UUID"))?;
        if !ids.insert(id) {
            return Err(AppError::invalid("experiences.id", "经历 ID 不能重复"));
        }
        for (key, min, max) in [
            ("title", 1, 100),
            ("organization", 0, 120),
            ("description", 0, 1000),
        ] {
            validation::text(
                "experiences",
                e[key].as_str().ok_or_else(AppError::bad)?,
                min,
                max,
            )?;
        }
        let start = e["start_date"].as_str().ok_or_else(AppError::bad)?;
        if !month(start) {
            return Err(AppError::invalid(
                "experiences.start_date",
                "月份必须为 YYYY-MM",
            ));
        }
        if !e["end_date"].is_null() {
            let end = e["end_date"].as_str().ok_or_else(AppError::bad)?;
            if !month(end) || end < start {
                return Err(AppError::invalid(
                    "experiences.end_date",
                    "结束月份无效或早于开始月份",
                ));
            }
        }
    }
    Ok(())
}
pub async fn update_profile_service(
    state: &AppState,
    admin: Uuid,
    input: Value,
) -> AppResult<Value> {
    validate_profile(&input)?;
    let version = input["version"]
        .as_i64()
        .filter(|v| *v > 0 && *v < i32::MAX as i64)
        .ok_or_else(AppError::bad)? as i32;
    let avatar = if input["avatar_media_id"].is_null() {
        None
    } else {
        Some(
            serde_json::from_value::<Uuid>(input["avatar_media_id"].clone())
                .map_err(|_| AppError::bad())?,
        )
    };
    let mut tx = state.db.begin().await?;
    lock_media_service(&mut tx, &avatar.into_iter().collect::<Vec<_>>()).await?;
    if !repository::update_profile_repository(&mut tx, &input, avatar, version).await? {
        return Err(AppError::conflict());
    }
    record_audit_service(&mut tx, Some(admin), "profile.update", "profile", "1").await?;
    tx.commit().await?;
    get_admin_profile_service(&state.db).await
}

#[cfg(test)]
mod tests {
    use super::month;
    #[test]
    fn months_are_real_month_strings_without_utf8_panics() {
        assert!(month("2026-10"));
        for value in [
            "2026-00",
            "2026-13",
            "0000-01",
            "2026-1",
            "2026-10-01",
            "你好a",
        ] {
            assert!(!month(value));
        }
    }
}
