use super::model::Profile;
use super::model::ProfileAvatar;
use sqlx::PgPool;
use uuid::Uuid;

// 查询唯一的个人资料记录
pub async fn find_profile_repository(pool: &PgPool) -> Result<Option<Profile>, sqlx::Error> {
    sqlx::query_as::<_, Profile>(
        r#"
        SELECT
            id,
            display_name,
            headline,
            intro,
            stats,
            bio_markdown,
            avatar_media_id,
            location_label,
            public_email,
            social_links,
            skill_groups,
            experiences,
            version,
            updated_at
        FROM site_profile
        WHERE id = $1
        "#,
    )
    .bind(1_i16)
    .fetch_optional(pool)
    .await
}

// 查询资料引用的可用头像，不读取媒体存储路径。
pub async fn find_profile_avatar_repository(
    pool: &PgPool,
    media_id: Uuid,
) -> Result<Option<ProfileAvatar>, sqlx::Error> {
    sqlx::query_as::<_, ProfileAvatar>(
        r#"
        SELECT id, width, height, alt
        FROM media_files
        WHERE id = $1 AND state = 'ready'
        "#,
    )
    .bind(media_id)
    .fetch_optional(pool)
    .await
}

// 完整更新资料，JSONB 集合随主记录受同一版本保护。
pub async fn update_profile_repository(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    input: &serde_json::Value,
    avatar: Option<Uuid>,
    version: i32,
) -> Result<bool, sqlx::Error> {
    Ok(sqlx::query(r#"
            UPDATE site_profile 
            SET display_name=$1,headline=$2,intro=$3,stats=$4,bio_markdown=$5,avatar_media_id=$6,location_label=$7,public_email=$8,social_links=$9,skill_groups=$10,experiences=$11,version=version+1,updated_at=now() 
            WHERE id=1 
            AND version=$12
            "#)
    .bind(input["display_name"].as_str()).bind(input["headline"].as_str()).bind(input["intro"].as_str()).bind(sqlx::types::Json(&input["stats"])).bind(input["bio_markdown"].as_str()).bind(avatar).bind(input["location_label"].as_str()).bind(input["public_email"].as_str()).bind(sqlx::types::Json(&input["social_links"])).bind(sqlx::types::Json(&input["skill_groups"])).bind(sqlx::types::Json(&input["experiences"])).bind(version).execute(&mut **tx).await?.rows_affected()==1)
}
