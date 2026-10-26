use super::service;
use crate::{
    common::response::one, error::AppResult, modules::auth::model::Session, state::AppState,
};
use axum::{Extension, Json, extract::State, response::Response};
use serde_json::Value;
pub async fn get_settings_handler(State(s): State<AppState>) -> AppResult<Response> {
    Ok(one(service::get_settings_service(&s, false).await?))
}
pub async fn get_admin_settings_handler(State(s): State<AppState>) -> AppResult<Response> {
    Ok(one(service::get_settings_service(&s, true).await?))
}
pub async fn update_settings_handler(
    State(s): State<AppState>,
    Extension(a): Extension<Session>,
    Json(v): Json<Value>,
) -> AppResult<Response> {
    Ok(one(
        service::update_settings_service(&s, a.admin_id, v).await?
    ))
}
