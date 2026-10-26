use crate::{modules::access::handler, state::AppState};
use axum::{Router, routing::get};
pub fn router() -> Router<AppState> {
    Router::new().route("/internal/access-check", get(handler::internal_handler))
}
