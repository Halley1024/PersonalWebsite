use crate::{
    error::AppResult,
    modules::auth::{model::Session, repository, service},
    state::AppState,
};
use axum::http::HeaderMap;
pub fn cookie(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get_all("cookie")
        .iter()
        .filter_map(|h| h.to_str().ok())
        .flat_map(|s| s.split(';'))
        .find_map(|pair| {
            let (k, v) = pair.trim().split_once('=')?;
            (k == name).then(|| v.to_owned())
        })
}
pub async fn read(state: &AppState, headers: &HeaderMap) -> AppResult<Option<Session>> {
    let Some(token) = cookie(headers, state.config.session_cookie()) else {
        return Ok(None);
    };
    if token.len() != 64 || !token.bytes().all(|x| x.is_ascii_hexdigit()) {
        return Ok(None);
    }
    Ok(repository::find_session_repository(
        &state.db,
        &service::hash_token(&token),
        state.clock.now(),
        state.config.session_idle_hours,
    )
    .await?)
}
