use super::{
    dto::{PageviewInput, VisitsQuery},
    model::VisitEvent,
    repository,
};
use crate::{
    common::validation,
    error::{AppError, AppResult},
    middleware::{request_id::RequestContext, session},
    modules::auth::service::random_token,
    state::AppState,
};
use axum::http::HeaderMap;
use chrono::{DateTime, Datelike, Duration, FixedOffset, Months, NaiveDate, TimeZone, Utc};
use hmac::{Hmac, Mac};
use serde_json::Value;
use sha2::Sha256;
use uuid::Uuid;
pub fn today(now: DateTime<Utc>) -> NaiveDate {
    now.with_timezone(&FixedOffset::east_opt(8 * 3600).unwrap())
        .date_naive()
}
pub fn midnight(date: NaiveDate) -> DateTime<Utc> {
    FixedOffset::east_opt(8 * 3600)
        .unwrap()
        .from_local_datetime(&date.and_hms_opt(0, 0, 0).unwrap())
        .single()
        .unwrap()
        .with_timezone(&Utc)
}
pub async fn record_pageview_service(
    s: &AppState,
    ctx: &RequestContext,
    headers: &HeaderMap,
    i: PageviewInput,
) -> AppResult<Option<String>> {
    if ctx.session.is_some() {
        return Ok(None);
    }
    validation::text("page_path", &i.page_path, 1, 300)?;
    if i.page_path.contains(['?', '#']) || i.page_path.ends_with('/') && i.page_path != "/" {
        return Err(AppError::invalid("page_path", "必须为规范公开路径"));
    }
    let (id, title) = match i.page_path.as_str() {
        "/" => (None, "首页".into()),
        "/about" => (None, "关于".into()),
        "/posts" => (None, "博客".into()),
        "/projects" => (None, "作品".into()),
        "/life" => (None, "生活".into()),
        path => {
            let mut parts = path.trim_start_matches('/').split('/');
            let kind = match parts.next() {
                Some("posts") => "blog",
                Some("projects") => "project",
                Some("life") => "life",
                _ => return Err(AppError::missing()),
            };
            let slug = parts
                .next()
                .filter(|x| validation::slug(x))
                .ok_or_else(AppError::missing)?;
            if parts.next().is_some() {
                return Err(AppError::missing());
            }
            let row = repository::published_path_repository(&s.db, kind, slug).await?;
            let (id, title) = row.ok_or_else(AppError::missing)?;
            (Some(id), title)
        }
    };
    let source = if let Some(raw) = i.referrer_origin {
        validation::text("referrer_origin", &raw, 1, 255)?;
        let url = url::Url::parse(&raw)
            .map_err(|_| AppError::invalid("referrer_origin", "来源 origin 无效"))?;
        if !["http", "https"].contains(&url.scheme()) || url.origin().ascii_serialization() != raw {
            return Err(AppError::invalid("referrer_origin", "只允许规范 origin"));
        }
        let host = url.host_str().unwrap_or_default();
        if host == "github.com" || host.ends_with(".github.com") {
            "github"
        } else if host == "bilibili.com" || host.ends_with(".bilibili.com") {
            "bilibili"
        } else if [
            "google.com",
            "www.google.com",
            "www.baidu.com",
            "bing.com",
            "www.bing.com",
            "duckduckgo.com",
        ]
        .contains(&host)
        {
            "search"
        } else {
            "other"
        }
    } else {
        "direct"
    };
    let existing = session::cookie(headers, s.config.visitor_cookie())
        .filter(|x| x.len() == 64 && x.bytes().all(|b| b.is_ascii_hexdigit()));
    let fresh = existing.is_none();
    let token = existing.unwrap_or_else(random_token);
    let mut mac =
        Hmac::<Sha256>::new_from_slice(&s.visitor_key).map_err(|_| AppError::internal())?;
    mac.update(token.as_bytes());
    let hash = mac.finalize().into_bytes().to_vec();
    let ua = headers
        .get("user-agent")
        .and_then(|x| x.to_str().ok())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let device = if ua.contains("ipad") || ua.contains("tablet") {
        "tablet"
    } else if ua.contains("mobile") || ua.contains("iphone") || ua.contains("android") {
        "mobile"
    } else if ua.contains("windows") || ua.contains("macintosh") || ua.contains("x11") {
        "desktop"
    } else {
        "unknown"
    };
    let (region_id, region_label, network_label) = s.geo.lookup(ctx.ip);
    repository::insert_event_repository(
        &s.db,
        &VisitEvent {
            id: Uuid::new_v4(),
            event_id: i.event_id,
            occurred_at: s.clock.now(),
            visitor_hash: hash,
            key_version: s.config.visitor_key_version,
            ip: ctx.ip.to_string(),
            region_id,
            region_label,
            network_label,
            page_path: i.page_path,
            page_title: title,
            content_id: id,
            source: source.into(),
            device: device.into(),
        },
    )
    .await?;
    Ok(fresh.then(|| {
        format!(
            "{}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000{}",
            s.config.visitor_cookie(),
            if s.config.production { "; Secure" } else { "" }
        )
    }))
}
pub async fn analytics_service(s: &AppState, days: i64) -> AppResult<Value> {
    let end = today(s.clock.now());
    let first = analytics_start(end, days)?;
    let window_days = (end - first).num_days() + 1;
    repository::analytics_repository(
        &s.db,
        midnight(first),
        midnight(end + Duration::days(1)),
        midnight(first - Duration::days(window_days)),
        first,
        end,
        days == 365,
    )
    .await
}

fn analytics_start(end: NaiveDate, days: i64) -> AppResult<NaiveDate> {
    match days {
        7 | 30 => Ok(end - Duration::days(days - 1)),
        365 => Ok(end.with_day(1).unwrap() - Months::new(11)),
        _ => Err(AppError::bad()),
    }
}

#[cfg(test)]
mod analytics_window_tests {
    use super::*;

    #[test]
    fn daily_windows_include_today_and_month_is_always_thirty_days() {
        let end = NaiveDate::from_ymd_opt(2024, 3, 1).unwrap();
        assert_eq!(analytics_start(end, 7).unwrap().to_string(), "2024-02-24");
        assert_eq!(analytics_start(end, 30).unwrap().to_string(), "2024-02-01");
        assert!(analytics_start(end, 8).is_err());
    }

    #[test]
    fn annual_window_has_twelve_calendar_months_even_on_leap_day() {
        for (end, first) in [
            ("2024-02-29", "2023-03-01"),
            ("2026-11-02", "2025-12-01"),
            ("2026-01-31", "2025-02-01"),
        ] {
            let end = end.parse::<NaiveDate>().unwrap();
            assert_eq!(analytics_start(end, 365).unwrap().to_string(), first);
        }
    }
}
pub async fn visits_service(
    s: &AppState,
    q: &VisitsQuery,
    size: i64,
    offset: i64,
) -> AppResult<(Vec<Value>, i64)> {
    let today = today(s.clock.now());
    let (start, end) = visits_window(today, q.start_date, q.end_date)?;
    if let Some(v) = &q.q {
        validation::text("q", v, 0, 100)?;
    }
    if q.source
        .as_ref()
        .is_some_and(|x| !["direct", "github", "search", "bilibili", "other"].contains(&x.as_str()))
    {
        return Err(AppError::bad());
    }
    if let Some(r) = &q.region_id {
        let found = repository::region_exists_repository(&s.db, r).await?;
        if !found {
            return Err(AppError::bad());
        }
    }
    repository::visits_repository(
        &s.db,
        q,
        midnight(start),
        midnight(end + Duration::days(1)),
        size,
        offset,
    )
    .await
}

// The queryable period is always the latest 30 Beijing calendar days, including today.
fn visits_window(
    today: NaiveDate,
    start: Option<NaiveDate>,
    end: Option<NaiveDate>,
) -> AppResult<(NaiveDate, NaiveDate)> {
    let minimum = today - Duration::days(29);
    let end = end.unwrap_or(today);
    let start = start.unwrap_or((end - Duration::days(6)).max(minimum));
    if start < minimum || start > end || end > today {
        return Err(AppError::bad());
    }
    Ok((start, end))
}

#[cfg(test)]
mod visits_window_tests {
    use super::*;
    #[test]
    fn only_latest_thirty_days_are_queryable() {
        let today = NaiveDate::from_ymd_opt(2026, 11, 2).unwrap();
        let oldest = today - Duration::days(29);
        assert_eq!(
            visits_window(today, Some(oldest), Some(today)).unwrap(),
            (oldest, today)
        );
        assert!(visits_window(today, Some(oldest - Duration::days(1)), Some(oldest)).is_err());
        assert!(visits_window(today, Some(today), Some(today + Duration::days(1))).is_err());
        assert!(visits_window(today, Some(today), Some(oldest)).is_err());
        assert_eq!(
            visits_window(today, None, None).unwrap(),
            (today - Duration::days(6), today)
        );
        assert_eq!(
            visits_window(today, None, Some(oldest)).unwrap(),
            (oldest, oldest)
        );
    }
}
