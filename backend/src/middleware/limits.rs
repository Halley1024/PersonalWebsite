use crate::{
    error::{AppError, AppResult},
    state::AppState,
};
use std::time::{Duration, Instant};
pub fn take(state: &AppState, key: &str, max: u32, seconds: u64) -> AppResult<()> {
    let mut map = state.limits.lock().map_err(|_| AppError::unavailable())?;
    let now = Instant::now();
    // 全部窗口最长 15 分钟，清理后仍满则拒绝，不允许无界内存增长。
    map.retain(|_, (time, _)| now.duration_since(*time) < Duration::from_secs(900));
    if map.len() >= 10000 && !map.contains_key(key) {
        return Err(AppError::new(
            axum::http::StatusCode::TOO_MANY_REQUESTS,
            "RATE_LIMITED",
            "请求过于频繁",
        ));
    }
    let entry = map.entry(key.into()).or_insert((now, 0));
    if now.duration_since(entry.0) >= Duration::from_secs(seconds) {
        *entry = (now, 0);
    }
    if entry.1 >= max {
        return Err(AppError::new(
            axum::http::StatusCode::TOO_MANY_REQUESTS,
            "RATE_LIMITED",
            "请求过于频繁",
        ));
    }
    entry.1 += 1;
    Ok(())
}
pub fn clear(state: &AppState, key: &str) {
    if let Ok(mut m) = state.limits.lock() {
        m.remove(key);
    }
}
