use crate::{
    modules::{access, analytics, auth, content, dashboard, media, profile, settings, taxonomy},
    state::AppState,
};
use axum::{
    Router,
    extract::DefaultBodyLimit,
    routing::{delete, get, post, put},
};
pub fn router() -> Router<AppState> {
    let uploads = Router::new()
        .route("/admin/media", post(media::handler::upload_handler))
        .layer(DefaultBodyLimit::max(12 * 1024 * 1024));
    Router::new()
        .merge(uploads)
        .route("/admin/password", put(auth::handler::password_handler))
        .route(
            "/admin/profile",
            get(profile::handler::get_admin_profile_handler)
                .put(profile::handler::update_profile_handler),
        )
        .route(
            "/admin/settings",
            get(settings::handler::get_admin_settings_handler)
                .put(settings::handler::update_settings_handler),
        )
        .route(
            "/admin/contents",
            get(content::handler::admin_list_handler).post(content::handler::create_handler),
        )
        .route(
            "/admin/contents/{id}",
            get(content::handler::admin_detail_handler)
                .put(content::handler::update_handler)
                .delete(content::handler::delete_handler),
        )
        .route(
            "/admin/contents/{id}/status",
            post(content::handler::status_handler),
        )
        .route(
            "/admin/categories",
            get(taxonomy::handler::list_categories_handler)
                .post(taxonomy::handler::create_category_handler),
        )
        .route(
            "/admin/categories/{id}",
            put(taxonomy::handler::update_category_handler)
                .delete(taxonomy::handler::delete_category_handler),
        )
        .route(
            "/admin/tags",
            get(taxonomy::handler::list_tags_handler).post(taxonomy::handler::create_tag_handler),
        )
        .route(
            "/admin/tags/{id}",
            put(taxonomy::handler::update_tag_handler)
                .delete(taxonomy::handler::delete_tag_handler),
        )
        .route("/admin/media", get(media::handler::list_media_handler))
        .route("/admin/media/{id}", delete(media::handler::delete_handler))
        .route(
            "/admin/dashboard",
            get(dashboard::handler::get_dashboard_handler),
        )
        .route(
            "/admin/analytics",
            get(analytics::handler::analytics_handler),
        )
        .route("/admin/visits", get(analytics::handler::visits_handler))
        .route("/admin/regions", get(access::handler::regions_handler))
        .route(
            "/admin/access-rules",
            get(access::handler::list_handler).post(access::handler::create_handler),
        )
        .route(
            "/admin/access-rules/{id}",
            put(access::handler::update_handler).delete(access::handler::delete_handler),
        )
}
