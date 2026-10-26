use crate::state::AppState;
use axum::{
    Json,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;
pub async fn live() -> Json<super::dto::HealthResponse> {
    Json(super::dto::HealthResponse { status: "ok" })
}
pub async fn ready(State(state): State<AppState>) -> Response {
    let result = tokio::time::timeout(std::time::Duration::from_secs(2), async {
        sqlx::query("SELECT 1")
            .execute(&state.db)
            .await
            .map_err(|_| ())?;
        let folder = std::env::var_os("MIGRATIONS_DIR")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| {
                std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("migrations")
            });
        let migrator = sqlx::migrate::Migrator::new(folder.as_path())
            .await
            .map_err(|_| ())?;
        let applied: Vec<(i64, Vec<u8>, bool)> = sqlx::query_as(
            "SELECT version,checksum,success FROM _sqlx_migrations ORDER BY version",
        )
        .fetch_all(&state.db)
        .await
        .map_err(|_| ())?;
        if applied.len() != migrator.iter().count()
            || !migrator.iter().all(|m| {
                applied.iter().any(|(v, checksum, success)| {
                    *v == m.version && checksum.as_slice() == m.checksum.as_ref() && *success
                })
            })
        {
            return Err(());
        }
        Ok(())
    })
    .await;
    if matches!(result, Ok(Ok(()))) {
        (StatusCode::OK, Json(json!({"status":"ok"}))).into_response()
    } else {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"status":"not_ready"})),
        )
            .into_response()
    }
}
