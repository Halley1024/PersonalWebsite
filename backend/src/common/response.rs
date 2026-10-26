use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use serde_json::{Value, json};
#[derive(Serialize)]
pub struct ApiResponse<T> {
    pub data: T, // 成功响应的数据。
} // 单对象成功响应外层。
impl<T> ApiResponse<T> {
    pub fn new(data: T) -> Self {
        Self { data }
    }
}
pub fn one(data: impl Serialize) -> Response {
    Json(ApiResponse::new(data)).into_response()
}
pub fn created(data: impl Serialize, location: String) -> Response {
    (
        StatusCode::CREATED,
        [("location", location)],
        Json(ApiResponse::new(data)),
    )
        .into_response()
}
pub fn page(data: Vec<Value>, page: i64, page_size: i64, total: i64) -> Response {
    Json(json!({"data":data,"meta":{"page":page,"page_size":page_size,"total":total,"total_pages":(total+page_size-1)/page_size}})).into_response()
}
