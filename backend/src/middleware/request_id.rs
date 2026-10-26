use crate::{
    error::{AppError, AppResult},
    modules::auth::model::Session,
    state::AppState,
};
use axum::{
    body::to_bytes,
    extract::{Request, State},
    http::{HeaderValue, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde_json::json;
use std::{net::IpAddr, time::Instant};
use uuid::Uuid;
#[derive(Clone)]
pub struct RequestContext {
    pub request_id: String,       // 用于串联响应、日志和审计的请求 ID。
    pub ip: IpAddr,               // 单个规范化 IP 地址。
    pub session: Option<Session>, // 当前请求的可选会话身份。
} // 每请求独立，不放进共享 AppState。
tokio::task_local! { pub static REQUEST_ID: String; }

pub async fn handle(State(state): State<AppState>, request: Request, next: Next) -> Response {
    use tracing::Instrument;
    let id = Uuid::new_v4().to_string();
    REQUEST_ID
        .scope(
            id.clone(),
            handle_inner(state, request, next, id.clone())
                .instrument(tracing::info_span!("http",request_id=%id)),
        )
        .await
}
async fn handle_inner(
    state: AppState,
    mut request: Request,
    next: Next,
    request_id: String,
) -> Response {
    let start = Instant::now();
    let route = request
        .extensions()
        .get::<axum::extract::MatchedPath>()
        .map(|p| p.as_str().to_owned())
        .unwrap_or_else(|| "unmatched".into());
    let path = request.uri().path().to_owned();
    let method = request.method().clone();
    let mut refresh_cookie = None;
    let prepared: AppResult<()> = async {
        let (ip, trusted) = super::client_ip::client(&state, &request)?;
        if path.starts_with("/internal/") && !trusted {
            return Err(AppError::missing());
        }
        let session = if path.starts_with("/api/") {
            super::session::read(&state, request.headers()).await?
        } else {
            None
        };
        // Cookie 的到期时间跟随数据库闲置期限；退出/改密码/登录由 handler 自行设置。
        if ![
            "/api/v1/auth/login",
            "/api/v1/auth/logout",
            "/api/v1/admin/password",
        ]
        .contains(&path.as_str())
            && let Some(identity) = &session
            && let Some(token) =
                super::session::cookie(request.headers(), state.config.session_cookie())
        {
            let remaining = (identity.expires_at - state.clock.now())
                .num_seconds()
                .max(0);
            refresh_cookie = Some(crate::modules::auth::service::cookie(
                &state, &token, remaining,
            ));
        }
        let admin = path.starts_with("/api/v1/admin/");
        let logout = path == "/api/v1/auth/logout";
        if admin || logout {
            let identity = session.clone().ok_or_else(AppError::unauthenticated)?;
            if !matches!(method, axum::http::Method::GET | axum::http::Method::HEAD) {
                super::origin::check(&state, request.headers())?;
                super::csrf::check(request.headers(), &identity)?;
            }
            request.extensions_mut().insert(identity);
        }
        if path == "/api/v1/auth/login" || path == "/api/v1/analytics/pageviews" {
            super::origin::check(&state, request.headers())?;
        }
        let json_required = path == "/api/v1/auth/login"
            || path == "/api/v1/analytics/pageviews"
            || (admin
                && matches!(method, axum::http::Method::POST | axum::http::Method::PUT)
                && path != "/api/v1/admin/media");
        if json_required
            && request
                .headers()
                .get("content-type")
                .and_then(|h| h.to_str().ok())
                .and_then(|h| h.split(';').next())
                .is_none_or(|h| !h.trim().eq_ignore_ascii_case("application/json"))
        {
            return Err(AppError::new(
                StatusCode::UNSUPPORTED_MEDIA_TYPE,
                "UNSUPPORTED_MEDIA_TYPE",
                "请求必须使用 application/json",
            ));
        }
        let public = (path.starts_with("/api/v1/") && !admin && !path.starts_with("/api/v1/auth/"))
            || path == "/sitemap.xml";
        if public {
            super::access::check(&state, ip).await?;
        }
        if method == axum::http::Method::POST && path == "/api/v1/admin/media" {
            let s = session.as_ref().ok_or_else(AppError::unauthenticated)?;
            super::limits::take(&state, &format!("upload:{}", s.id), 20, 60)?;
        }
        if path == "/api/v1/analytics/pageviews" {
            super::limits::take(&state, &format!("events:{ip}"), 60, 60)?;
        }
        request.extensions_mut().insert(RequestContext {
            request_id: request_id.clone(),
            ip,
            session,
        });
        Ok(())
    }
    .await;
    let timeout = if path == "/api/v1/admin/media" {
        30
    } else {
        15
    };
    let mut response = match prepared {
        Err(e) => e.into_response(),
        Ok(()) => {
            match tokio::time::timeout(std::time::Duration::from_secs(timeout), next.run(request))
                .await
            {
                Ok(r) => r,
                Err(_) => AppError::unavailable().into_response(),
            }
        }
    };
    // 统一提取器错误、未知路由及业务错误，不把 SQL/正文返回到客户端。
    if !path.starts_with("/health/")
        && (response.status().is_client_error() || response.status().is_server_error())
    {
        let status = response.status();
        let (headers, body) = {
            let (parts, body) = response.into_parts();
            (parts.headers, body)
        };
        let bytes = to_bytes(body, 1024 * 1024).await.unwrap_or_default();
        let mut value=serde_json::from_slice::<serde_json::Value>(&bytes).ok().filter(|v|v.get("error").and_then(|e|e.get("code")).is_some()).unwrap_or_else(||json!({"error":{"code":match status.as_u16(){404=>"NOT_FOUND",405=>"METHOD_NOT_ALLOWED",413=>"PAYLOAD_TOO_LARGE",415=>"UNSUPPORTED_MEDIA_TYPE",422=>"VALIDATION_ERROR",500=>"INTERNAL_ERROR",503=>"SERVICE_UNAVAILABLE",_=>"BAD_REQUEST"},"message":"请求无法处理","fields":{},"request_id":""}}));
        value["error"]["request_id"] = json!(request_id);
        response = (status, axum::Json(value)).into_response();
        for name in ["allow", "retry-after", "set-cookie"] {
            if let Some(v) = headers.get(name) {
                response.headers_mut().insert(
                    axum::http::HeaderName::from_bytes(name.as_bytes()).expect("固定头名称有效"),
                    v.clone(),
                );
            }
        }
    }
    response.headers_mut().insert(
        "x-request-id",
        HeaderValue::from_str(&request_id).expect("UUID 是合法头值"),
    );
    response
        .headers_mut()
        .insert("cache-control", HeaderValue::from_static("no-store"));
    response.headers_mut().insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    if response.status() == StatusCode::TOO_MANY_REQUESTS {
        response
            .headers_mut()
            .insert("retry-after", HeaderValue::from_static("900"));
    }
    if let Some(cookie) = refresh_cookie {
        response.headers_mut().append(
            "set-cookie",
            HeaderValue::from_str(&cookie).expect("已验证 token 的 Cookie 头合法"),
        );
    }
    tracing::info!(
        request_id,
        route,
        status = response.status().as_u16(),
        elapsed_ms = start.elapsed().as_millis() as u64,
        "HTTP 请求完成"
    );
    response
}
