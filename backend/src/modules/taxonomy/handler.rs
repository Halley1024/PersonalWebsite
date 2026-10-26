use super::{
    dto::{KindQuery, TaxonomyQuery, VersionQuery},
    repository, service,
};
use crate::{
    common::{pagination, response, validation},
    error::AppResult,
    modules::auth::model::Session,
    state::AppState,
};
use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::StatusCode,
    response::Response,
};
use serde_json::Value;
use uuid::Uuid;
macro_rules! handlers {
    ($public:ident,$list:ident,$create:ident,$update:ident,$delete:ident,$tags:expr) => {
        pub async fn $public(
            State(s): State<AppState>,
            Query(q): Query<KindQuery>,
        ) -> AppResult<Response> {
            validation::kind(&q.kind)?;
            Ok(response::one(
                repository::public_taxonomy_repository(&s.db, $tags, &q.kind).await?,
            ))
        }
        pub async fn $list(
            State(s): State<AppState>,
            Query(q): Query<TaxonomyQuery>,
        ) -> AppResult<Response> {
            if let Some(k) = &q.kind {
                validation::kind(k)?;
            }
            let (p, size, offset) = pagination::bounds(q.page, q.page_size, 50, 100)?;
            let (rows, total) =
                repository::list_taxonomy_repository(&s.db, $tags, q.kind.as_deref(), size, offset)
                    .await?;
            Ok(response::page(rows, p, size, total))
        }
        pub async fn $create(
            State(s): State<AppState>,
            Extension(a): Extension<Session>,
            Json(v): Json<Value>,
        ) -> AppResult<Response> {
            let data = service::save_taxonomy_service(&s, a.admin_id, $tags, None, v).await?;
            let location = format!(
                "/api/v1/admin/{}/{}",
                repository::table($tags),
                data["id"].as_str().unwrap_or_default()
            );
            Ok(response::created(data, location))
        }
        pub async fn $update(
            State(s): State<AppState>,
            Extension(a): Extension<Session>,
            Path(id): Path<Uuid>,
            Json(v): Json<Value>,
        ) -> AppResult<Response> {
            Ok(response::one(
                service::save_taxonomy_service(&s, a.admin_id, $tags, Some(id), v).await?,
            ))
        }
        pub async fn $delete(
            State(s): State<AppState>,
            Extension(a): Extension<Session>,
            Path(id): Path<Uuid>,
            Query(q): Query<VersionQuery>,
        ) -> AppResult<StatusCode> {
            service::delete_taxonomy_service(&s, a.admin_id, $tags, id, q.version).await?;
            Ok(StatusCode::NO_CONTENT)
        }
    };
}
handlers!(
    public_categories_handler,
    list_categories_handler,
    create_category_handler,
    update_category_handler,
    delete_category_handler,
    false
);
handlers!(
    public_tags_handler,
    list_tags_handler,
    create_tag_handler,
    update_tag_handler,
    delete_tag_handler,
    true
);
