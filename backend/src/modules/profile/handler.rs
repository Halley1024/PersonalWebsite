use super::service;
use crate::{
    common::response::one, error::AppResult, modules::auth::model::Session, state::AppState,
};
use axum::{Extension, Json, extract::State, response::Response};
use serde_json::Value;
pub async fn get_profile_handler(State(state): State<AppState>) -> AppResult<Response> {
    Ok(one(service::get_profile_service(&state.db).await?))
}
pub async fn get_admin_profile_handler(State(state): State<AppState>) -> AppResult<Response> {
    Ok(one(service::get_admin_profile_service(&state.db).await?))
}
pub async fn update_profile_handler(
    State(state): State<AppState>,
    Extension(admin): Extension<Session>,
    Json(input): Json<Value>,
) -> AppResult<Response> {
    Ok(one(service::update_profile_service(
        &state,
        admin.admin_id,
        input,
    )
    .await?))
}
