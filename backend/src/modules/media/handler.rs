use super::{
    dto::{MediaListQuery, MediaQuery},
    repository, service,
};
use crate::{
    common::{pagination, response},
    error::{AppError, AppResult},
    middleware::request_id::RequestContext,
    modules::auth::model::Session,
    state::AppState,
};
use axum::{
    Extension,
    extract::{Multipart, Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use tokio::io::AsyncWriteExt;
use uuid::Uuid;
pub async fn read_media_handler(
    State(s): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Path(id): Path<Uuid>,
    Query(q): Query<MediaQuery>,
) -> AppResult<Response> {
    let (data, mime) = service::read_media_service(
        &s,
        id,
        q.variant.as_deref().unwrap_or("original"),
        ctx.session.is_some(),
    )
    .await?;
    Ok(([("content-type", mime)], data).into_response())
}
pub async fn list_media_handler(
    State(s): State<AppState>,
    Query(q): Query<MediaListQuery>,
) -> AppResult<Response> {
    let (p, size, offset) = pagination::bounds(q.page, q.page_size, 20, 50)?;
    let (rows, total) =
        repository::list_media_repository(&s.db, offset, size, q.unused.unwrap_or(false)).await?;
    Ok(response::page(rows, p, size, total))
}
pub async fn upload_handler(
    State(s): State<AppState>,
    Extension(a): Extension<Session>,
    mut multipart: Multipart,
) -> AppResult<Response> {
    let temp = s
        .config
        .media_root
        .join(".tmp")
        .join(Uuid::new_v4().to_string());
    let mut has_file = false;
    let mut alt = None;
    let result: AppResult<_> = async {
        while let Some(mut field) = multipart.next_field().await.map_err(|_| AppError::bad())? {
            match field.name() {
                Some("file") if !has_file => {
                    has_file = true;
                    let mut file = tokio::fs::File::create(&temp).await?;
                    let mut size = 0;
                    while let Some(chunk) = field.chunk().await.map_err(|_| AppError::bad())? {
                        size += chunk.len();
                        if size > 10 * 1024 * 1024 {
                            return Err(AppError::new(
                                StatusCode::PAYLOAD_TOO_LARGE,
                                "PAYLOAD_TOO_LARGE",
                                "图片不得超过 10 MiB",
                            ));
                        }
                        file.write_all(&chunk).await?;
                    }
                    file.flush().await?;
                }
                Some("alt") if alt.is_none() => {
                    let bytes = field.bytes().await.map_err(|_| AppError::bad())?;
                    if bytes.len() > 800 {
                        return Err(AppError::invalid("alt", "替代文本过长"));
                    }
                    alt = Some(String::from_utf8(bytes.to_vec()).map_err(|_| AppError::bad())?);
                }
                _ => {
                    return Err(AppError::invalid(
                        "multipart",
                        "只允许一张图片和一个 alt 字段",
                    ));
                }
            }
        }
        if !has_file {
            return Err(AppError::invalid("file", "请选择图片"));
        }
        let data = tokio::fs::read(&temp).await?;
        service::upload_service(&s, a.admin_id, data, alt.unwrap_or_default()).await
    }
    .await;
    let _ = tokio::fs::remove_file(temp).await;
    let dto = result?;
    let location = format!("/api/v1/media/{}", dto["id"].as_str().unwrap_or_default());
    Ok(response::created(dto, location))
}
pub async fn delete_handler(
    State(s): State<AppState>,
    Extension(a): Extension<Session>,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    service::delete_media_service(&s, id, Some(a.admin_id)).await?;
    Ok(StatusCode::NO_CONTENT)
}
