use super::model::Media;
use crate::error::{AppError, AppResult};
use serde_json::Value;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;
pub async fn find_media_repository(pool: &PgPool, id: Uuid) -> AppResult<Media> {
    sqlx::query_as("SELECT storage_key,thumbnail_key,mime_type,state FROM media_files WHERE id=$1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(AppError::missing)
}
pub async fn reference_count_repository(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
) -> AppResult<i64> {
    Ok(sqlx::query_scalar(
        r#"
            SELECT (
            SELECT count(*) 
            FROM content_items 
            WHERE cover_media_id=$1)+(
            SELECT count(*) 
            FROM content_media 
            WHERE media_id=$1)+(
            SELECT count(*) 
            FROM site_profile 
            WHERE avatar_media_id=$1)
            "#,
    )
    .bind(id)
    .fetch_one(&mut **tx)
    .await?)
}
pub async fn public_media_repository(pool: &PgPool, id: Uuid) -> AppResult<bool> {
    Ok(sqlx::query_scalar(
        r#"
            SELECT EXISTS(
            SELECT 1 
            FROM site_profile 
            WHERE avatar_media_id=$1) OR EXISTS(
            SELECT 1 
            FROM content_items 
            WHERE cover_media_id=$1 
            AND status='published') OR EXISTS(
            SELECT 1 
            FROM content_media cm 
            JOIN content_items c 
            ON c.id=cm.content_id 
            WHERE cm.media_id=$1 
            AND c.status='published')
            "#,
    )
    .bind(id)
    .fetch_one(pool)
    .await?)
}
// 每张图片按内容类型分别计数，封面、正文及相册的重复引用不重复计数。
fn usage_cte() -> String {
    let mut fields = Vec::new();
    for kind in ["blog", "project", "life"] {
        fields.push(format!("(EXISTS(SELECT 1 FROM content_items c WHERE c.cover_media_id=m.id AND c.kind='{kind}') OR EXISTS(SELECT 1 FROM content_media cm JOIN content_items c ON c.id=cm.content_id WHERE cm.media_id=m.id AND c.kind='{kind}')) AS {kind}"));
    }
    format!(
        "WITH media_usage AS (SELECT m.*,{}, NOT EXISTS(SELECT 1 FROM content_items WHERE cover_media_id=m.id) AND NOT EXISTS(SELECT 1 FROM content_media WHERE media_id=m.id) AND NOT EXISTS(SELECT 1 FROM site_profile WHERE avatar_media_id=m.id) AS unused FROM media_files m WHERE m.state='ready')",
        fields.join(",")
    )
}
pub async fn media_stats_repository(pool: &PgPool) -> AppResult<Value> {
    let (value,): (Value,) = sqlx::query_as(&format!("{} SELECT jsonb_build_object('all',count(*),'blog',count(*) FILTER(WHERE blog),'project',count(*) FILTER(WHERE project),'life',count(*) FILTER(WHERE life),'unused',count(*) FILTER(WHERE unused)) FROM media_usage", usage_cte())).fetch_one(pool).await?;
    Ok(value)
}
pub async fn list_media_repository(
    pool: &PgPool,
    offset: i64,
    size: i64,
    unused: bool,
    kind: Option<&str>,
    q: Option<&str>,
) -> AppResult<(Vec<Value>, i64)> {
    let cte = usage_cte();
    let filter = "WHERE (NOT $1 OR m.unused) AND ($2::text IS NULL OR CASE $2 WHEN 'blog' THEN m.blog WHEN 'project' THEN m.project WHEN 'life' THEN m.life ELSE false END) AND ($3::text IS NULL OR m.alt ILIKE $3)";
    let q = q.map(crate::common::pagination::literal_like);
    let mut tx = pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *tx)
        .await?;
    let total: i64 = sqlx::query_scalar(&format!(
        "{cte} SELECT count(*) FROM media_usage m {filter}"
    ))
    .bind(unused)
    .bind(kind)
    .bind(&q)
    .fetch_one(&mut *tx)
    .await?;
    let rows: Vec<(Value,)> = sqlx::query_as(&format!("{cte} SELECT jsonb_build_object('id',m.id,'url','/api/v1/media/'||m.id,'thumbnail_url','/api/v1/media/'||m.id||'?variant=thumb','mime_type',m.mime_type,'byte_size',m.byte_size,'width',m.width,'height',m.height,'alt',m.alt,'created_at',m.created_at,'reference_count',(SELECT count(*) FROM content_items WHERE cover_media_id=m.id)+(SELECT count(*) FROM content_media WHERE media_id=m.id)+(SELECT count(*) FROM site_profile WHERE avatar_media_id=m.id)) FROM media_usage m {filter} ORDER BY m.created_at DESC,m.id DESC LIMIT $4 OFFSET $5")).bind(unused).bind(kind).bind(&q).bind(size).bind(offset).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok((rows.into_iter().map(|row| row.0).collect(), total))
}

pub async fn lock_media_repository(
    tx: &mut Transaction<'_, Postgres>,
    ids: &[Uuid],
) -> AppResult<Vec<(Uuid, String)>> {
    Ok(
        sqlx::query_as("SELECT id,state FROM media_files WHERE id=ANY($1) ORDER BY id FOR UPDATE")
            .bind(ids)
            .fetch_all(&mut **tx)
            .await?,
    )
}
pub async fn insert_media_repository(
    tx: &mut Transaction<'_, Postgres>,
    m: super::model::NewMedia<'_>,
) -> AppResult<()> {
    sqlx::query("SELECT pg_advisory_xact_lock(73810925)")
        .execute(&mut **tx)
        .await?;
    let total: i64 =
        sqlx::query_scalar("SELECT COALESCE(sum(byte_size),0)::bigint FROM media_files")
            .fetch_one(&mut **tx)
            .await?;
    if total + m.byte_size > 2 * 1024 * 1024 * 1024 {
        return Err(AppError::invalid("file", "媒体原图总量超过首期 2 GiB 配额"));
    }
    sqlx::query(r#"
            INSERT INTO media_files(id,storage_key,thumbnail_key,mime_type,byte_size,width,height,alt,sha256) 
            VALUES($1,$2,$3,'image/webp',$4,$5,$6,$7,$8)
            "#).bind(m.id).bind(m.original).bind(m.thumbnail).bind(m.byte_size).bind(m.width).bind(m.height).bind(m.alt).bind(m.sha256).execute(&mut **tx).await?;
    Ok(())
}
pub async fn lock_paths_repository(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
) -> AppResult<(String, String)> {
    sqlx::query_as("SELECT storage_key,thumbnail_key FROM media_files WHERE id=$1 FOR UPDATE")
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(AppError::missing)
}
pub async fn mark_deleting_repository(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
) -> AppResult<()> {
    sqlx::query("UPDATE media_files SET state='deleting' WHERE id=$1")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}
pub async fn delete_metadata_repository(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
) -> AppResult<()> {
    sqlx::query("DELETE FROM media_files WHERE id=$1 AND state='deleting'")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn storage_keys_repository(
    pool: &PgPool,
) -> AppResult<std::collections::HashSet<String>> {
    Ok(sqlx::query_scalar(
        "SELECT storage_key FROM media_files UNION SELECT thumbnail_key FROM media_files",
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .collect())
}
pub async fn deleting_ids_repository(pool: &PgPool) -> AppResult<Vec<Uuid>> {
    Ok(
        sqlx::query_scalar("SELECT id FROM media_files WHERE state='deleting'")
            .fetch_all(pool)
            .await?,
    )
}
pub async fn key_exists_repository(pool: &PgPool, key: &str) -> AppResult<bool> {
    Ok(sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM media_files WHERE storage_key=$1 OR thumbnail_key=$1)",
    )
    .bind(key)
    .fetch_one(pool)
    .await?)
}

#[cfg(test)]
mod library_tests {
    use super::*;
    #[tokio::test]
    #[ignore = "requires TEST_DATABASE_URL pointing to an independent empty database"]
    async fn media_filters_counts_and_reference_deduplication() {
        let url = std::env::var("TEST_DATABASE_URL").unwrap();
        assert_ne!(url, std::env::var("DATABASE_URL").unwrap_or_default());
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(3)
            .connect(&url)
            .await
            .unwrap();
        let count: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(count, 0);
        let folder = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
        sqlx::migrate::Migrator::new(folder.as_path())
            .await
            .unwrap()
            .run(&pool)
            .await
            .unwrap();
        let ids: Vec<Uuid> = (0..6).map(|_| Uuid::new_v4()).collect();
        for (index, alt) in [
            "共享封面",
            "海边",
            "头像",
            "100xy岩壁",
            "100%_岩壁",
            "删除中",
        ]
        .iter()
        .enumerate()
        {
            sqlx::query("INSERT INTO media_files(id,storage_key,thumbnail_key,mime_type,byte_size,width,height,alt,sha256,state) VALUES($1,$2,$3,'image/webp',1024,800,600,$4,$5,$6)")
                .bind(ids[index]).bind(format!("original-{index}")).bind(format!("thumb-{index}")).bind(alt).bind(vec![0u8;32]).bind(if index == 5 {"deleting"} else {"ready"}).execute(&pool).await.unwrap();
        }
        let blog = Uuid::new_v4();
        for (id, kind, media) in [
            (blog, "blog", ids[0]),
            (Uuid::new_v4(), "project", ids[0]),
            (Uuid::new_v4(), "life", ids[1]),
        ] {
            sqlx::query("INSERT INTO content_items(id,kind,title,slug,excerpt,cover_media_id,status) VALUES($1,$2,'测试',$3,'测试',$4,'archived')")
                .bind(id).bind(kind).bind(format!("item-{kind}")).bind(media).execute(&pool).await.unwrap();
        }
        sqlx::query("INSERT INTO content_media(content_id,media_id,role) VALUES($1,$2,'body')")
            .bind(blog)
            .bind(ids[0])
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("UPDATE site_profile SET avatar_media_id=$1 WHERE id=1")
            .bind(ids[2])
            .execute(&pool)
            .await
            .unwrap();
        let expected = serde_json::json!({"all":5,"blog":1,"project":1,"life":1,"unused":2});
        assert_eq!(media_stats_repository(&pool).await.unwrap(), expected);
        let (rows, total) = list_media_repository(&pool, 0, 12, false, Some("blog"), None)
            .await
            .unwrap();
        assert_eq!(total, 1);
        assert_eq!(rows[0]["id"], ids[0].to_string());
        assert_eq!(rows[0]["reference_count"], 3);
        let (first, total) = list_media_repository(&pool, 0, 1, true, None, None)
            .await
            .unwrap();
        let (second, _) = list_media_repository(&pool, 1, 1, true, None, None)
            .await
            .unwrap();
        assert_eq!(total, 2);
        assert_ne!(first[0]["id"], second[0]["id"]);
        let (literal, total) = list_media_repository(&pool, 0, 12, false, None, Some("100%_"))
            .await
            .unwrap();
        assert_eq!(total, 1);
        assert_eq!(literal[0]["id"], ids[4].to_string());
        assert_eq!(
            list_media_repository(&pool, 0, 12, false, Some("project"), Some("海边"))
                .await
                .unwrap()
                .1,
            0
        );
        assert_eq!(
            media_stats_repository(&pool).await.unwrap(),
            expected,
            "统计不受搜索和分页影响"
        );
        sqlx::query("DELETE FROM media_files WHERE id=$1")
            .bind(ids[4])
            .execute(&pool)
            .await
            .unwrap();
        assert_eq!(media_stats_repository(&pool).await.unwrap()["unused"], 1);
        sqlx::query("UPDATE content_items SET cover_media_id=NULL WHERE id=$1")
            .bind(blog)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("DELETE FROM content_media WHERE content_id=$1")
            .bind(blog)
            .execute(&pool)
            .await
            .unwrap();
        let stats = media_stats_repository(&pool).await.unwrap();
        assert_eq!(stats["blog"], 0);
        assert_eq!(stats["project"], 1);
        pool.close().await;
    }
}
