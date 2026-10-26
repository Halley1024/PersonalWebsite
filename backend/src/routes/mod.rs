use crate::{error::AppError, modules::content::handler, state::AppState};
use axum::{Router, routing::get};
mod admin;
mod analytics;
mod auth;
mod health;
mod internal;
mod media;
mod public;
pub fn build_router() -> Router<AppState> {
    Router::new()
        .merge(health::router())
        .merge(internal::router())
        .route("/sitemap.xml", get(handler::sitemap_handler))
        .nest(
            "/api/v1",
            public::router()
                .merge(auth::router())
                .merge(admin::router())
                .merge(media::router())
                .merge(analytics::router()),
        )
        .fallback(|| async { AppError::missing() })
}
