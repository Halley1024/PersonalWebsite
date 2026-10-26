use super::{
    dto::{AdminQuery, PublicQuery, StatusInput},
    repository, service,
};
use crate::{
    common::{pagination, response, validation},
    error::{AppError, AppResult},
    modules::{auth::model::Session, taxonomy::dto::VersionQuery},
    state::AppState,
};
use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::Value;
use uuid::Uuid;
async fn public_list(s: AppState, q: PublicQuery, kind: &str) -> AppResult<Response> {
    let (p, size, offset) = pagination::bounds(q.page, q.page_size, 12, 50)?;
    if let Some(q) = &q.q {
        validation::text("q", q, 0, 100)?;
    }
    let sort = match kind {
        "project" => "project",
        "life" => "life",
        _ => "published",
    };
    let (rows, total) = repository::list_content_repository(
        &s.db,
        Some(kind),
        Some("published"),
        q.q.as_deref(),
        q.category.as_deref(),
        q.tag.as_deref(),
        q.featured,
        sort,
        size,
        offset,
    )
    .await?;
    Ok(response::page(
        rows.into_iter()
            .map(|v| service::public_content(v, false))
            .collect(),
        p,
        size,
        total,
    ))
}
macro_rules! public_handlers {
    ($list:ident,$detail:ident,$kind:expr) => {
        pub async fn $list(
            State(s): State<AppState>,
            Query(q): Query<PublicQuery>,
        ) -> AppResult<Response> {
            public_list(s, q, $kind).await
        }
        pub async fn $detail(
            State(s): State<AppState>,
            Path(slug): Path<String>,
        ) -> AppResult<Response> {
            if !validation::slug(&slug) {
                return Err(AppError::missing());
            }
            Ok(response::one(service::public_content(
                repository::find_detail_repository(&s.db, None, Some($kind), Some(&slug), true)
                    .await?,
                true,
            )))
        }
    };
}
public_handlers!(posts_handler, post_handler, "blog");
public_handlers!(projects_handler, project_handler, "project");
public_handlers!(life_list_handler, life_handler, "life");
pub async fn admin_list_handler(
    State(s): State<AppState>,
    Query(q): Query<AdminQuery>,
) -> AppResult<Response> {
    if let Some(k) = &q.kind {
        validation::kind(k)?;
    }
    if q.status
        .as_ref()
        .is_some_and(|status| !["draft", "published", "archived"].contains(&status.as_str()))
    {
        return Err(AppError::bad());
    }
    if let Some(q) = &q.q {
        validation::text("q", q, 0, 100)?;
    }
    let (p, size, offset) = pagination::bounds(q.page, q.page_size, 20, 50)?;
    let sort = q.sort.as_deref().unwrap_or("updated_desc");
    if !["updated_desc", "created_desc", "sort_asc"].contains(&sort) {
        return Err(AppError::bad());
    }
    let (rows, total) = repository::list_content_repository(
        &s.db,
        q.kind.as_deref(),
        q.status.as_deref(),
        q.q.as_deref(),
        q.category.as_deref(),
        q.tag.as_deref(),
        None,
        sort,
        size,
        offset,
    )
    .await?;
    Ok(response::page(rows, p, size, total))
}
pub async fn admin_detail_handler(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<Response> {
    Ok(response::one(
        repository::find_detail_repository(&s.db, Some(id), None, None, false).await?,
    ))
}
pub async fn create_handler(
    State(s): State<AppState>,
    Extension(a): Extension<Session>,
    Json(v): Json<Value>,
) -> AppResult<Response> {
    let data = service::save_content_service(&s, a.admin_id, None, v).await?;
    let location = format!(
        "/api/v1/admin/contents/{}",
        data["id"].as_str().unwrap_or_default()
    );
    Ok(response::created(data, location))
}
pub async fn update_handler(
    State(s): State<AppState>,
    Extension(a): Extension<Session>,
    Path(id): Path<Uuid>,
    Json(v): Json<Value>,
) -> AppResult<Response> {
    Ok(response::one(
        service::save_content_service(&s, a.admin_id, Some(id), v).await?,
    ))
}
pub async fn status_handler(
    State(s): State<AppState>,
    Extension(a): Extension<Session>,
    Path(id): Path<Uuid>,
    Json(v): Json<StatusInput>,
) -> AppResult<Response> {
    Ok(response::one(
        service::change_status_service(&s, a.admin_id, id, v).await?,
    ))
}
pub async fn delete_handler(
    State(s): State<AppState>,
    Extension(a): Extension<Session>,
    Path(id): Path<Uuid>,
    Query(v): Query<VersionQuery>,
) -> AppResult<StatusCode> {
    service::delete_content_service(&s, a.admin_id, id, v.version).await?;
    Ok(StatusCode::NO_CONTENT)
}
pub async fn sitemap_handler(State(s): State<AppState>) -> AppResult<Response> {
    let rows = service::sitemap_service(&s).await?;
    let mut xml = String::from(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",
    );
    for (kind, slug) in rows {
        let prefix = match kind.as_str() {
            "blog" => "posts",
            "project" => "projects",
            _ => "life",
        };
        let url = format!("{}/{prefix}/{slug}", s.config.public_origin)
            .replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;");
        xml.push_str(&format!("<url><loc>{url}</loc></url>"));
    }
    xml.push_str("</urlset>");
    Ok(([("content-type", "application/xml; charset=utf-8")], xml).into_response())
}
