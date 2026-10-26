use super::{dto::RulesQuery, repository, service};
use crate::{
    common::{pagination, response, validation},
    error::{AppError, AppResult},
    middleware::request_id::RequestContext,
    modules::{auth::model::Session, taxonomy::dto::VersionQuery},
    state::AppState,
};
use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::StatusCode,
    response::Response,
};
use serde_json::Value;
use uuid::Uuid;
pub async fn regions_handler(State(s): State<AppState>) -> AppResult<Response> {
    Ok(response::one(repository::regions_repository(&s.db).await?))
}
pub async fn list_handler(
    State(s): State<AppState>,
    Query(q): Query<RulesQuery>,
) -> AppResult<Response> {
    if q.scope
        .as_ref()
        .is_some_and(|x| !["ip", "region"].contains(&x.as_str()))
        || q.state
            .as_ref()
            .is_some_and(|x| !["active", "expired", "disabled"].contains(&x.as_str()))
    {
        return Err(AppError::bad());
    }
    if let Some(v) = &q.q {
        validation::text("q", v, 0, 100)?;
    }
    let (p, size, offset) = pagination::bounds(q.page, q.page_size, 20, 50)?;
    let (rows, total) = repository::list_rules_repository(&s.db, &q, size, offset).await?;
    Ok(response::page(rows, p, size, total))
}
pub async fn create_handler(
    State(s): State<AppState>,
    Extension(a): Extension<Session>,
    Json(v): Json<Value>,
) -> AppResult<Response> {
    let data = service::save_rule_service(&s, a.admin_id, None, v).await?;
    let loc = format!(
        "/api/v1/admin/access-rules/{}",
        data["id"].as_str().unwrap_or_default()
    );
    Ok(response::created(data, loc))
}
pub async fn update_handler(
    State(s): State<AppState>,
    Extension(a): Extension<Session>,
    Path(id): Path<Uuid>,
    Json(v): Json<Value>,
) -> AppResult<Response> {
    Ok(response::one(
        service::save_rule_service(&s, a.admin_id, Some(id), v).await?,
    ))
}
pub async fn delete_handler(
    State(s): State<AppState>,
    Extension(a): Extension<Session>,
    Path(id): Path<Uuid>,
    Query(q): Query<VersionQuery>,
) -> AppResult<StatusCode> {
    service::delete_rule_service(&s, a.admin_id, id, q.version).await?;
    Ok(StatusCode::NO_CONTENT)
}
pub async fn internal_handler(
    State(s): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
) -> AppResult<StatusCode> {
    let (region, _, _) = s.geo.lookup(ctx.ip);
    if service::denied_service(&s, ctx.ip, &region).await? {
        return Err(AppError::new(
            StatusCode::FORBIDDEN,
            "ACCESS_DENIED",
            "访问被拒绝",
        ));
    }
    Ok(StatusCode::NO_CONTENT)
}
