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
pub async fn list_media_repository(
    pool: &PgPool,
    offset: i64,
    size: i64,
    unused: bool,
) -> AppResult<(Vec<Value>, i64)> {
    let filter = "NOT $1 OR NOT EXISTS(SELECT 1 FROM content_items WHERE cover_media_id=m.id) AND NOT EXISTS(SELECT 1 FROM content_media WHERE media_id=m.id) AND NOT EXISTS(SELECT 1 FROM site_profile WHERE avatar_media_id=m.id)";
    let mut tx = pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *tx)
        .await?;
    let total: i64 = sqlx::query_scalar(&format!(
        "SELECT count(*) FROM media_files m WHERE {filter}"
    ))
    .bind(unused)
    .fetch_one(&mut *tx)
    .await?;
    let rows:Vec<(Value,)>=sqlx::query_as(&format!("SELECT jsonb_build_object('id',m.id,'url','/api/v1/media/'||m.id,'thumbnail_url','/api/v1/media/'||m.id||'?variant=thumb','mime_type',m.mime_type,'byte_size',m.byte_size,'width',m.width,'height',m.height,'alt',m.alt,'created_at',m.created_at,'reference_count',(SELECT count(*) FROM content_items WHERE cover_media_id=m.id)+(SELECT count(*) FROM content_media WHERE media_id=m.id)+(SELECT count(*) FROM site_profile WHERE avatar_media_id=m.id)) FROM media_files m WHERE {filter} ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3")).bind(unused).bind(size).bind(offset).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok((rows.into_iter().map(|r| r.0).collect(), total))
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
