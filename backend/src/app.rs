use crate::{routes, state::AppState};
use axum::{Router, extract::DefaultBodyLimit, middleware};
pub fn build_app(state: AppState) -> Router {
    routes::build_router() // 创建一个路有
        .layer(DefaultBodyLimit::max(1024 * 1024))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            crate::middleware::request_id::handle,
        ))
        .with_state(state)
}
