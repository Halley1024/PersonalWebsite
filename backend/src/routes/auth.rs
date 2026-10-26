use crate::{modules::auth::handler, state::AppState};
use axum::{
    Router,
    routing::{get, post},
};
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/auth/login", post(handler::login_handler))
        .route("/auth/session", get(handler::session_handler))
        .route("/auth/logout", post(handler::logout_handler))
}
