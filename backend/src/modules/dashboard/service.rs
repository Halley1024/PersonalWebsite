use crate::{error::AppResult, modules::content::repository, state::AppState};
use serde_json::{Value, json};
pub async fn get_dashboard_service(s: &AppState) -> AppResult<Value> {
    let counts = repository::counts_repository(&s.db).await?;
    let (recent, _) = repository::list_content_repository(
        &s.db,
        None,
        None,
        None,
        None,
        None,
        None,
        "updated_desc",
        10,
        0,
    )
    .await?;
    Ok(
        json!({"counts":counts.into_iter().map(super::dto::ContentCount::from).collect::<Vec<_>>(),"recent_contents":recent}),
    )
}
