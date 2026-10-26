use serde::Serialize;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str, // 业务状态。
}
