use super::service;
use crate::{common::response::one, error::AppResult, state::AppState};
use axum::{extract::State, response::Response};
pub async fn get_dashboard_handler(State(s): State<AppState>) -> AppResult<Response> {
    Ok(one(service::get_dashboard_service(&s).await?))
}
