use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;
use std::collections::BTreeMap;

#[derive(Debug)]
pub struct AppError {
    pub status: StatusCode,               // 对外 HTTP 状态。
    pub code: &'static str,               // 稳定业务错误码。
    pub message: &'static str,            // 可公开提示，不能包含 SQL 或秘密。
    pub fields: BTreeMap<String, String>, // 字段校验错误。
}
pub type AppResult<T> = Result<T, AppError>;
impl AppError {
    pub fn new(status: StatusCode, code: &'static str, message: &'static str) -> Self {
        Self {
            status,
            code,
            message,
            fields: BTreeMap::new(),
        }
    }
    pub fn invalid(field: &str, message: &str) -> Self {
        let mut e = Self::new(
            StatusCode::UNPROCESSABLE_ENTITY,
            "VALIDATION_ERROR",
            "请检查输入字段",
        );
        e.fields.insert(field.into(), message.into());
        e
    }
    pub fn bad() -> Self {
        Self::new(StatusCode::BAD_REQUEST, "BAD_REQUEST", "请求参数无效")
    }
    pub fn missing() -> Self {
        Self::new(StatusCode::NOT_FOUND, "NOT_FOUND", "资源不存在")
    }
    pub fn conflict() -> Self {
        Self::new(
            StatusCode::CONFLICT,
            "VERSION_CONFLICT",
            "数据已更新，请刷新后重试",
        )
    }
    pub fn internal() -> Self {
        Self::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "INTERNAL_ERROR",
            "服务暂时不可用",
        )
    }
    pub fn unavailable() -> Self {
        Self::new(
            StatusCode::SERVICE_UNAVAILABLE,
            "SERVICE_UNAVAILABLE",
            "依赖暂时不可用",
        )
    }
    pub fn unauthenticated() -> Self {
        Self::new(StatusCode::UNAUTHORIZED, "UNAUTHENTICATED", "请先登录")
    }
    pub fn in_use() -> Self {
        Self::new(
            StatusCode::CONFLICT,
            "RESOURCE_IN_USE",
            "资源仍被引用，无法删除",
        )
    }
}
impl From<sqlx::Error> for AppError {
    fn from(error: sqlx::Error) -> Self {
        if let sqlx::Error::Database(ref e) = error {
            match e.code().as_deref() {
                Some("23505") => {
                    return Self::new(StatusCode::CONFLICT, "SLUG_CONFLICT", "唯一字段已存在");
                }
                Some("23503" | "23001") => return Self::in_use(),
                Some("23514" | "23502" | "22001") => {
                    return Self::invalid("data", "数据不符合数据库约束");
                }
                _ => {}
            }
        }
        // 只记录类别，不输出可能含用户数据的 SQL、参数或错误详情。
        tracing::error!("数据库操作失败");
        match error {
            sqlx::Error::PoolTimedOut | sqlx::Error::PoolClosed | sqlx::Error::Io(_) => {
                Self::unavailable()
            }
            _ => Self::internal(),
        }
    }
}
impl From<std::io::Error> for AppError {
    fn from(_: std::io::Error) -> Self {
        Self::internal()
    }
}
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (self.status,Json(json!({"error":{"code":self.code,"message":self.message,"fields":self.fields,"request_id":""}}))).into_response()
    }
}
