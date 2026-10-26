use super::{
    dto::{LoginInput, PasswordInput},
    model::Session,
    service,
};
use crate::{
    common::response::one,
    error::{AppError, AppResult},
    middleware::request_id::RequestContext,
    state::AppState,
};
use axum::{
    Extension, Json,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;
pub async fn login_handler(
    State(state): State<AppState>,
    Extension(ctx): Extension<RequestContext>,
    Json(input): Json<LoginInput>,
) -> AppResult<Response> {
    let (data, cookie) = service::login_service(&state, &ctx, input).await?;
    Ok(([("set-cookie", cookie)], one(data)).into_response())
}
pub async fn session_handler(Extension(ctx): Extension<RequestContext>) -> Response {
    one(match ctx.session {
        Some(s) => {
            json!({"authenticated":true,"admin":{"id":s.admin_id,"username":s.username},"csrf_token":s.csrf_token,"expires_at":s.expires_at})
        }
        None => json!({"authenticated":false}),
    })
}
pub async fn logout_handler(
    State(state): State<AppState>,
    Extension(session): Extension<Session>,
) -> AppResult<Response> {
    service::logout_service(&state, session.id).await?;
    Ok((
        StatusCode::NO_CONTENT,
        [("set-cookie", service::cookie(&state, "", 0))],
    )
        .into_response())
}
pub async fn password_handler(
    State(state): State<AppState>,
    Extension(session): Extension<Session>,
    Json(input): Json<PasswordInput>,
) -> Result<Response, AppError> {
    service::change_password_service(&state, &session, input).await?;
    Ok((
        StatusCode::NO_CONTENT,
        [("set-cookie", service::cookie(&state, "", 0))],
    )
        .into_response())
}
