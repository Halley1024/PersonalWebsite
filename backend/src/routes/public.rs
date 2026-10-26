use crate::{
    modules::{content, profile, settings, taxonomy},
    state::AppState,
};
use axum::{Router, routing::get};
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/profile", get(profile::handler::get_profile_handler))
        .route("/settings", get(settings::handler::get_settings_handler))
        .route("/posts", get(content::handler::posts_handler))
        .route("/posts/{slug}", get(content::handler::post_handler))
        .route("/projects", get(content::handler::projects_handler))
        .route("/projects/{slug}", get(content::handler::project_handler))
        .route("/life", get(content::handler::life_list_handler))
        .route("/life/{slug}", get(content::handler::life_handler))
        .route(
            "/categories",
            get(taxonomy::handler::public_categories_handler),
        )
        .route("/tags", get(taxonomy::handler::public_tags_handler))
}
