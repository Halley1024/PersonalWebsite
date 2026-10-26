use crate::{modules::health::handler, state::AppState};
use axum::{Router, routing::get};
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health/live", get(handler::live))
        .route("/health/ready", get(handler::ready))
}
