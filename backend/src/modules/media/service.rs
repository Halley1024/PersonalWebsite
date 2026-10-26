use super::{processing, repository};
use crate::{
    error::{AppError, AppResult},
    modules::audit::service::record_audit_service,
    state::AppState,
    storage::local,
};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;
pub async fn lock_media_service(tx: &mut Transaction<'_, Postgres>, ids: &[Uuid]) -> AppResult<()> {
    let mut ids = ids.to_vec();
    ids.sort();
    ids.dedup();
    let rows = repository::lock_media_repository(tx, &ids).await?;
    if rows.len() != ids.len() || rows.iter().any(|(_, s)| s != "ready") {
        return Err(AppError::invalid("media", "媒体不存在或不可用"));
    }
    Ok(())
}
pub async fn upload_service(
    state: &AppState,
    admin: Uuid,
    bytes: Vec<u8>,
    alt: String,
) -> AppResult<Value> {
    crate::common::validation::text("alt", &alt, 0, 200)?;
    if fs2::available_space(&state.config.media_root)? < 512 * 1024 * 1024 {
        return Err(AppError::unavailable());
    }
    let permit = state
        .image_jobs
        .clone()
        .acquire_owned()
        .await
        .map_err(|_| AppError::unavailable())?;
    let data = tokio::task::spawn_blocking(move || {
        let _permit = permit;
        processing::process(&bytes)
    })
    .await
    .map_err(|_| AppError::internal())??;
    let id = Uuid::new_v4();
    let prefix = format!("{}/{id}", state.clock.now().format("%Y/%m"));
    let original = format!("{prefix}/original.webp");
    let thumb = format!("{prefix}/thumb.webp");
    local::write_atomic(&state.config.media_root, &original, &data.original).await?;
    if let Err(e) = local::write_atomic(&state.config.media_root, &thumb, &data.thumbnail).await {
        let _ = local::remove(&state.config.media_root, &original).await;
        return Err(e);
    }
    let result: AppResult<()> = async {
        let mut tx = state.db.begin().await?;
        repository::insert_media_repository(
            &mut tx,
            super::model::NewMedia {
                id,
                original: &original,
                thumbnail: &thumb,
                byte_size: data.original.len() as i64,
                width: data.width as i32,
                height: data.height as i32,
                alt: &alt,
                sha256: Sha256::digest(&data.original).to_vec(),
            },
        )
        .await?;
        record_audit_service(
            &mut tx,
            Some(admin),
            "media.upload",
            "media",
            &id.to_string(),
        )
        .await?;
        tx.commit().await?;
        Ok(())
    }
    .await;
    if let Err(e) = result {
        let _ = local::remove(&state.config.media_root, &original).await;
        let _ = local::remove(&state.config.media_root, &thumb).await;
        return Err(e);
    }
    Ok(
        json!({"id":id,"url":format!("/api/v1/media/{id}"),"thumbnail_url":format!("/api/v1/media/{id}?variant=thumb"),"mime_type":"image/webp","byte_size":data.original.len(),"width":data.width,"height":data.height,"alt":alt,"created_at":state.clock.now(),"reference_count":0}),
    )
}
pub async fn read_media_service(
    state: &AppState,
    id: Uuid,
    variant: &str,
    authenticated: bool,
) -> AppResult<(Vec<u8>, String)> {
    if !["original", "thumb"].contains(&variant) {
        return Err(AppError::bad());
    }
    let media = repository::find_media_repository(&state.db, id).await?;
    if media.state != "ready"
        || (!authenticated && !repository::public_media_repository(&state.db, id).await?)
    {
        return Err(AppError::missing());
    }
    let data = local::read(
        &state.config.media_root,
        if variant == "thumb" {
            &media.thumbnail_key
        } else {
            &media.storage_key
        },
    )
    .await?;
    Ok((
        data,
        if variant == "thumb" {
            "image/webp".into()
        } else {
            media.mime_type
        },
    ))
}
pub async fn delete_media_service(
    state: &AppState,
    id: Uuid,
    admin: Option<Uuid>,
) -> AppResult<()> {
    let mut tx = state.db.begin().await?;
    let (original, thumb) = repository::lock_paths_repository(&mut tx, id).await?;
    if repository::reference_count_repository(&mut tx, id).await? > 0 {
        return Err(AppError::in_use());
    }
    repository::mark_deleting_repository(&mut tx, id).await?;
    record_audit_service(
        &mut tx,
        admin,
        "media.mark_deleting",
        "media",
        &id.to_string(),
    )
    .await?;
    tx.commit().await?;
    local::remove(&state.config.media_root, &original).await?;
    local::remove(&state.config.media_root, &thumb).await?;
    let mut tx = state.db.begin().await?;
    repository::delete_metadata_repository(&mut tx, id).await?;
    record_audit_service(&mut tx, admin, "media.delete", "media", &id.to_string()).await?;
    tx.commit().await?;
    Ok(())
}
