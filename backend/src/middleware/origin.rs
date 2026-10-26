use crate::{
    error::{AppError, AppResult},
    state::AppState,
};
use axum::http::HeaderMap;
pub fn check(state: &AppState, headers: &HeaderMap) -> AppResult<()> {
    if headers.get("origin").and_then(|x| x.to_str().ok())
        != Some(state.config.public_origin.as_str())
    {
        return Err(AppError::new(
            axum::http::StatusCode::FORBIDDEN,
            "ORIGIN_FORBIDDEN",
            "来源不受信任",
        ));
    }
    Ok(())
}
