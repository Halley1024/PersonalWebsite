use crate::{modules::analytics::handler, state::AppState};
use axum::{Router, extract::DefaultBodyLimit, routing::post};
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/analytics/pageviews", post(handler::pageview_handler))
        .layer(DefaultBodyLimit::max(4096))
}
