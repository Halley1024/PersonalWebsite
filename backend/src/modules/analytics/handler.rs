use super::{
    dto::{AnalyticsQuery, PageviewInput, VisitsQuery},
    service,
};
use crate::{
    common::{pagination, response},
    error::AppResult,
    middleware::request_id::RequestContext,
    state::AppState,
};
use axum::{
    Extension, Json,
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
pub async fn pageview_handler(
    State(s): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    headers: HeaderMap,
    Json(i): Json<PageviewInput>,
) -> AppResult<Response> {
    let cookie = service::record_pageview_service(&s, &ctx, &headers, i).await?;
    Ok(match cookie {
        Some(cookie) => (StatusCode::NO_CONTENT, [("set-cookie", cookie)]).into_response(),
        None => StatusCode::NO_CONTENT.into_response(),
    })
}
pub async fn analytics_handler(
    State(s): State<AppState>,
    Query(q): Query<AnalyticsQuery>,
) -> AppResult<Response> {
    Ok(response::one(
        service::analytics_service(&s, q.days.unwrap_or(7)).await?,
    ))
}
pub async fn visits_handler(
    State(s): State<AppState>,
    Query(q): Query<VisitsQuery>,
) -> AppResult<Response> {
    let (p, size, offset) = pagination::bounds(q.page, q.page_size, 20, 50)?;
    let (rows, total) = service::visits_service(&s, &q, size, offset).await?;
    Ok(response::page(rows, p, size, total))
}
