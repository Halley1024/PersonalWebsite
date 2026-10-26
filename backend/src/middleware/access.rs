use crate::{
    error::{AppError, AppResult},
    state::AppState,
};
use std::net::IpAddr;
pub async fn check(state: &AppState, ip: IpAddr) -> AppResult<()> {
    let (region, _, _) = state.geo.lookup(ip);
    if crate::modules::access::service::denied_service(state, ip, &region).await? {
        return Err(AppError::new(
            axum::http::StatusCode::FORBIDDEN,
            "ACCESS_DENIED",
            "访问被拒绝",
        ));
    }
    Ok(())
}
