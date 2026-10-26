use crate::{
    error::{AppError, AppResult},
    modules::auth::model::Session,
};
use axum::http::HeaderMap;
use subtle::ConstantTimeEq;
pub fn check(headers: &HeaderMap, session: &Session) -> AppResult<()> {
    let token = headers
        .get("x-csrf-token")
        .map(|x| x.as_bytes())
        .unwrap_or_default();
    if !bool::from(token.ct_eq(session.csrf_token.as_bytes())) {
        return Err(AppError::new(
            axum::http::StatusCode::FORBIDDEN,
            "CSRF_FAILED",
            "CSRF 校验失败",
        ));
    }
    Ok(())
}
