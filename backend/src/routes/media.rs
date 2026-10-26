use crate::{modules::media::handler, state::AppState};
use axum::{Router, routing::get};
pub fn router() -> Router<AppState> {
    Router::new().route("/media/{id}", get(handler::read_media_handler))
}
