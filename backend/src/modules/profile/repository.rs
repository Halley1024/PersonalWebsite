use super::model::Profile;
use super::model::ProfileAvatar;
use sqlx::PgPool;
use uuid::Uuid;

// 查询唯一的个人资料记录
pub async fn find_profile_repository(pool: &PgPool) -> Result<Option<Profile>, sqlx::Error> {
    // 将数据库中的字段一一映射到Profile结构体上
    sqlx::query_as::<_, Profile>(
        r#"
        SELECT
            id,
            display_name,
            headline,
            intro,
            stats || (
                SELECT jsonb_build_object(
                    'projects', (count(*) FILTER (WHERE kind = 'project'))::text,
                    'notes', (count(*) FILTER (WHERE kind = 'blog'))::text
                )
                FROM content_items WHERE status = 'published'
            ) AS stats,
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
            SET display_name=$1,headline=$2,intro=$3,stats=jsonb_build_object('experience',$4::jsonb->'experience','projects','','notes',''),bio_markdown=$5,avatar_media_id=$6,location_label=$7,public_email=$8,social_links=$9,skill_groups=$10,experiences=$11,version=version+1,updated_at=now()
            WHERE id=1 
            AND version=$12
            "#)
    .bind(input["display_name"].as_str()).bind(input["headline"].as_str()).bind(input["intro"].as_str()).bind(sqlx::types::Json(&input["stats"])).bind(input["bio_markdown"].as_str()).bind(avatar).bind(input["location_label"].as_str()).bind(input["public_email"].as_str()).bind(sqlx::types::Json(&input["social_links"])).bind(sqlx::types::Json(&input["skill_groups"])).bind(sqlx::types::Json(&input["experiences"])).bind(version).execute(&mut **tx).await?.rows_affected()==1)
}

#[cfg(test)]
mod stats_tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    #[ignore = "requires TEST_DATABASE_URL pointing to an independent empty database"]
    async fn published_counts_are_live_and_only_experience_is_writable() {
        let url = std::env::var("TEST_DATABASE_URL").unwrap();
        assert_ne!(url, std::env::var("DATABASE_URL").unwrap_or_default());
        let pool = PgPool::connect(&url).await.unwrap();
        let tables: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(tables, 0, "test requires an independent empty database");
        sqlx::migrate::Migrator::new(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations"),
        )
        .await
        .unwrap()
        .run(&pool)
        .await
        .unwrap();
        sqlx::query("UPDATE site_profile SET stats=$1")
            .bind(json!({"experience":"3+","projects":"999","notes":"888"}))
            .execute(&pool)
            .await
            .unwrap();
        let profile = find_profile_repository(&pool).await.unwrap().unwrap();
        assert_eq!(profile.stats.0.projects, "0");
        assert_eq!(profile.stats.0.notes, "0");
        for (kind, slug, status) in [
            ("project", "one", "published"),
            ("project", "two", "published"),
            ("project", "draft", "draft"),
            ("project", "archived", "archived"),
            ("blog", "one", "published"),
            ("blog", "draft", "draft"),
            ("blog", "archived", "archived"),
            ("life", "one", "published"),
        ] {
            sqlx::query("INSERT INTO content_items(id,kind,slug,title,excerpt,status,published_at) VALUES($1,$2,$3,'title','excerpt',$4,CASE WHEN $4='published' THEN now() END)")
                .bind(Uuid::new_v4()).bind(kind).bind(slug).bind(status).execute(&pool).await.unwrap();
        }
        let profile = super::super::service::get_profile_service(&pool)
            .await
            .unwrap();
        assert_eq!(profile.stats.projects, "2");
        assert_eq!(profile.stats.notes, "1");
        assert_eq!(profile.stats.experience, "3+");
        sqlx::query(
            "UPDATE content_items SET status='archived' WHERE kind='project' AND slug='one'",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query("UPDATE content_items SET status='published',published_at=now() WHERE kind='blog' AND slug='draft'").execute(&pool).await.unwrap();
        let profile = super::super::service::get_admin_profile_service(&pool)
            .await
            .unwrap();
        assert_eq!(profile["stats"]["projects"], "1");
        assert_eq!(profile["stats"]["notes"], "2");
        sqlx::query("DELETE FROM content_items WHERE kind='blog' AND slug='one'")
            .execute(&pool)
            .await
            .unwrap();
        let mut input = profile;
        input["stats"] = json!({"experience":"7+","projects":"9000","notes":"8000"});
        let mut tx = pool.begin().await.unwrap();
        assert!(
            update_profile_repository(&mut tx, &input, None, 1)
                .await
                .unwrap()
        );
        tx.commit().await.unwrap();
        let result = super::super::service::get_admin_profile_service(&pool)
            .await
            .unwrap();
        assert_eq!(
            result["stats"],
            json!({"experience":"7+","projects":"1","notes":"1"})
        );
        assert_eq!(result["version"], 2);
        pool.close().await;
    }
}
