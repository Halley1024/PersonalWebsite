//! 使用独立 PostgreSQL 的关键业务流程验收；不会连接默认业务库。
use axum::{
    Router,
    body::{Body, to_bytes},
    http::{HeaderMap, Request, StatusCode},
};
use backend::{app, cli, config::Config, state::AppState};
use serde_json::{Value, json};
use sqlx::postgres::PgPoolOptions;
use std::io::Cursor;
use tower::ServiceExt;

async fn request(
    app: &Router,
    method: &str,
    path: &str,
    body: Option<Value>,
    cookie: Option<&str>,
    csrf: Option<&str>,
    origin: bool,
) -> (StatusCode, HeaderMap, Value) {
    let mut builder = Request::builder().method(method).uri(path);
    if origin {
        builder = builder.header("origin", "http://localhost:5173");
    }
    if let Some(c) = cookie {
        builder = builder.header("cookie", c);
    }
    if let Some(c) = csrf {
        builder = builder.header("x-csrf-token", c);
    }
    let body = if let Some(v) = body {
        builder = builder.header("content-type", "application/json");
        Body::from(v.to_string())
    } else {
        Body::empty()
    };
    let response = app
        .clone()
        .oneshot(builder.body(body).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let headers = response.headers().clone();
    let bytes = to_bytes(response.into_body(), 16 * 1024 * 1024)
        .await
        .unwrap();
    let data = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    (status, headers, data)
}
fn content(kind: &str, slug: &str, category: Option<&str>, tags: Vec<&str>) -> Value {
    json!({"kind":kind,"slug":slug,"title":"测试内容","excerpt":"真实数据库集成测试","body_markdown":"","cover_media_id":null,"category_id":category,"tag_ids":tags,"featured":false,"sort_order":0,"seo_title":null,"seo_description":null,"gallery":[],"project":if kind=="project"{json!({"tech_stack":["Rust"],"project_stage":"building","started_on":"2026-01-01","ended_on":null,"repository_url":null,"demo_url":null})}else{Value::Null},"life":if kind=="life"{json!({"occurred_on":"2026-01-01","location_label":null})}else{Value::Null}})
}

#[tokio::test]
#[ignore = "需设置 TEST_DATABASE_URL 指向独立空库，再执行 --ignored"]
async fn authenticated_content_media_analytics_access_flow() {
    let url = std::env::var("TEST_DATABASE_URL").expect("必须显式指定独立测试库");
    assert_ne!(
        url,
        std::env::var("DATABASE_URL").unwrap_or_default(),
        "不得复用当前业务库"
    );
    let pool = PgPoolOptions::new()
        .max_connections(8)
        .connect(&url)
        .await
        .unwrap();
    let count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count, 0, "测试只接受空库");
    let folder = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("migrations");
    sqlx::migrate::Migrator::new(folder.as_path())
        .await
        .unwrap()
        .run(&pool)
        .await
        .unwrap();
    let root = std::env::temp_dir().join(format!("personal-website-test-{}", uuid::Uuid::new_v4()));
    let mut config = Config::from_env().unwrap();
    config.database_url = url;
    config.production = false;
    config.public_origin = "http://localhost:5173".into();
    config.media_root = root.clone();
    config.visitor_key_file = None;
    config.trusted_proxies.clear();
    config.geoip_file = None;
    let state = AppState::new(&config).await.unwrap();
    let app = app::build_app(state.clone());
    assert_eq!(
        request(&app, "GET", "/health/ready", None, None, None, false)
            .await
            .0,
        StatusCode::OK
    );
    let (status, headers, profile) =
        request(&app, "GET", "/api/v1/profile", None, None, None, false).await;
    assert_eq!(status, 200);
    assert_eq!(profile["data"]["display_name"], "站主");
    assert!(headers.contains_key("x-request-id"));
    assert_eq!(headers["cache-control"], "no-store");
    assert_eq!(
        request(
            &app,
            "GET",
            "/api/v1/admin/profile",
            None,
            None,
            None,
            false
        )
        .await
        .0,
        401
    );
    cli::create_admin(&state, "Owner".into(), "correct test password".into())
        .await
        .unwrap();
    let login = json!({"username":"owner","password":"correct test password"});
    assert_eq!(
        request(
            &app,
            "POST",
            "/api/v1/auth/login",
            Some(login.clone()),
            None,
            None,
            false
        )
        .await
        .0,
        403
    );
    assert_eq!(
        request(
            &app,
            "POST",
            "/api/v1/auth/login",
            Some(json!({"username":"owner","password":"wrong"})),
            None,
            None,
            true
        )
        .await
        .0,
        401
    );
    let (status, headers, data) = request(
        &app,
        "POST",
        "/api/v1/auth/login",
        Some(login),
        None,
        None,
        true,
    )
    .await;
    assert_eq!(status, 200, "{data}");
    let cookie = headers["set-cookie"]
        .to_str()
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_owned();
    let csrf = data["data"]["csrf_token"].as_str().unwrap().to_owned();
    // 滑动更新数据库期限的同时刷新 Cookie，且不超过绝对期限。
    sqlx::query("UPDATE admin_sessions SET created_at=now()-interval '1 hour',last_seen_at=now()-interval '10 minutes',expires_at=now()+interval '30 minutes' WHERE csrf_token=$1").bind(&csrf).execute(&pool).await.unwrap();
    let (status, session_headers, session) = request(
        &app,
        "GET",
        "/api/v1/auth/session",
        None,
        Some(&cookie),
        None,
        false,
    )
    .await;
    assert_eq!(status, 200);
    assert_eq!(session["data"]["authenticated"], true);
    let cookie_age = session_headers["set-cookie"]
        .to_str()
        .unwrap()
        .split(';')
        .find_map(|p| p.trim().strip_prefix("Max-Age="))
        .unwrap()
        .parse::<i64>()
        .unwrap();
    assert!(cookie_age > 43000 && cookie_age <= 43200);

    let (_, _, settings) = request(
        &app,
        "GET",
        "/api/v1/admin/settings",
        None,
        Some(&cookie),
        None,
        false,
    )
    .await;
    let mut settings = settings["data"].clone();
    settings.as_object_mut().unwrap().remove("updated_at");
    settings["site_name"] = json!("测试站点");
    assert_eq!(
        request(
            &app,
            "PUT",
            "/api/v1/admin/settings",
            Some(settings.clone()),
            Some(&cookie),
            None,
            true
        )
        .await
        .0,
        403
    );
    assert_eq!(
        request(
            &app,
            "PUT",
            "/api/v1/admin/settings",
            Some(settings.clone()),
            Some(&cookie),
            Some(&csrf),
            true
        )
        .await
        .0,
        200
    );
    assert_eq!(
        request(
            &app,
            "PUT",
            "/api/v1/admin/settings",
            Some(settings),
            Some(&cookie),
            Some(&csrf),
            true
        )
        .await
        .0,
        409
    );
    let (_, _, profile) = request(
        &app,
        "GET",
        "/api/v1/admin/profile",
        None,
        Some(&cookie),
        None,
        false,
    )
    .await;
    let mut update = profile["data"].clone();
    update.as_object_mut().unwrap().remove("avatar");
    update.as_object_mut().unwrap().remove("updated_at");
    update["headline"] = json!("已更新");
    assert_eq!(
        request(
            &app,
            "PUT",
            "/api/v1/admin/profile",
            Some(update.clone()),
            Some(&cookie),
            Some(&csrf),
            true
        )
        .await
        .0,
        200
    );
    assert_eq!(
        request(
            &app,
            "PUT",
            "/api/v1/admin/profile",
            Some(update),
            Some(&cookie),
            Some(&csrf),
            true
        )
        .await
        .0,
        409
    );

    // 审计写入失败时，资料/设置写事务也必须整体回滚。
    sqlx::query("CREATE FUNCTION reject_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit rejection'; END $$").execute(&pool).await.unwrap();
    sqlx::query("CREATE TRIGGER reject_test_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_test_audit()").execute(&pool).await.unwrap();
    let (_, _, current_settings) = request(
        &app,
        "GET",
        "/api/v1/admin/settings",
        None,
        Some(&cookie),
        None,
        false,
    )
    .await;
    let mut rejected = current_settings["data"].clone();
    rejected.as_object_mut().unwrap().remove("updated_at");
    rejected["site_name"] = json!("不应保存");
    let (status, headers, failure) = request(
        &app,
        "PUT",
        "/api/v1/admin/settings",
        Some(rejected),
        Some(&cookie),
        Some(&csrf),
        true,
    )
    .await;
    assert_eq!(status, 500);
    assert_eq!(
        failure["error"]["request_id"],
        headers["x-request-id"].to_str().unwrap()
    );
    assert!(!failure.to_string().contains("test audit rejection"));
    sqlx::query("DROP TRIGGER reject_test_audit ON audit_logs")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DROP FUNCTION reject_test_audit()")
        .execute(&pool)
        .await
        .unwrap();
    let (name, version): (String, i32) =
        sqlx::query_as("SELECT site_name,version FROM site_settings")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(name, "测试站点");
    assert_eq!(version, 2);
    assert_eq!(
        request(
            &app,
            "PUT",
            "/api/v1/admin/settings",
            Some(json!({"site_name":"bad"})),
            Some(&cookie),
            Some(&csrf),
            true
        )
        .await
        .0,
        422
    );
    assert_eq!(
        request(
            &app,
            "GET",
            "/api/v1/posts?page_size=51",
            None,
            None,
            None,
            false
        )
        .await
        .0,
        400
    );
    let category = json!({"kind":"blog","name":"Rust","slug":"rust","sort_order":0});
    let (status, _, cat) = request(
        &app,
        "POST",
        "/api/v1/admin/categories",
        Some(category),
        Some(&cookie),
        Some(&csrf),
        true,
    )
    .await;
    assert_eq!(status, 201, "{cat}");
    let cat = cat["data"]["id"].as_str().unwrap();
    let (status, _, tag) = request(
        &app,
        "POST",
        "/api/v1/admin/tags",
        Some(json!({"kind":"blog","name":"Rust","slug":"rust"})),
        Some(&cookie),
        Some(&csrf),
        true,
    )
    .await;
    assert_eq!(status, 201, "{tag}");
    let tag = tag["data"]["id"].as_str().unwrap();
    let mut invalid = content("project", "wrong-category", Some(cat), vec![]);
    invalid["body_markdown"] = json!("正文");
    assert_eq!(
        request(
            &app,
            "POST",
            "/api/v1/admin/contents",
            Some(invalid),
            Some(&cookie),
            Some(&csrf),
            true
        )
        .await
        .0,
        422
    );
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM content_items")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0, "关联失败不能留下部分内容");
    let (status, _, draft) = request(
        &app,
        "POST",
        "/api/v1/admin/contents",
        Some(content("blog", "first", Some(cat), vec![tag])),
        Some(&cookie),
        Some(&csrf),
        true,
    )
    .await;
    assert_eq!(status, 201, "{draft}");
    let id = draft["data"]["id"].as_str().unwrap().to_owned();
    let path = format!("/api/v1/admin/contents/{id}");
    assert_eq!(
        request(&app, "GET", "/api/v1/posts/first", None, None, None, false)
            .await
            .0,
        404
    );
    assert_eq!(
        request(
            &app,
            "POST",
            &format!("{path}/status"),
            Some(json!({"status":"published","version":1})),
            Some(&cookie),
            Some(&csrf),
            true
        )
        .await
        .0,
        422
    );
    // 实际图片经 multipart 上传、解码和重编码，不能只伪造媒体元数据。
    let mut png = Cursor::new(Vec::new());
    image::DynamicImage::new_rgb8(4, 4)
        .write_to(&mut png, image::ImageFormat::Png)
        .unwrap();
    let mut body=b"--test-boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"test.png\"\r\nContent-Type: image/png\r\n\r\n".to_vec();
    body.extend(png.into_inner());
    body.extend(b"\r\n--test-boundary--\r\n");
    let upload = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/admin/media")
                .header(
                    "content-type",
                    "multipart/form-data; boundary=test-boundary",
                )
                .header("cookie", &cookie)
                .header("origin", "http://localhost:5173")
                .header("x-csrf-token", &csrf)
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = upload.status();
    let bytes = to_bytes(upload.into_body(), 1024 * 1024).await.unwrap();
    let media: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(status, 201, "{media}");
    let media_id = media["data"]["id"].as_str().unwrap();
    let media_path = format!("/api/v1/media/{media_id}");
    assert_eq!(
        request(&app, "GET", &media_path, None, None, None, false)
            .await
            .0,
        404
    );
    assert_eq!(
        request(&app, "GET", &media_path, None, Some(&cookie), None, false)
            .await
            .0,
        200
    );
    let mut edit = content("blog", "first", Some(cat), vec![tag]);
    edit.as_object_mut().unwrap().remove("kind");
    edit.as_object_mut().unwrap().remove("slug");
    edit["version"] = json!(1);
    edit["body_markdown"] = json!(format!("# 正文\n![图片](media:{media_id})"));
    edit["cover_media_id"] = json!(media_id);
    let (a, b) = tokio::join!(
        request(
            &app,
            "PUT",
            &path,
            Some(edit.clone()),
            Some(&cookie),
            Some(&csrf),
            true
        ),
        request(
            &app,
            "PUT",
            &path,
            Some(edit.clone()),
            Some(&cookie),
            Some(&csrf),
            true
        )
    );
    let mut statuses = [a.0.as_u16(), b.0.as_u16()];
    statuses.sort();
    assert_eq!(statuses, [200, 409]);
    assert_eq!(
        request(
            &app,
            "DELETE",
            &format!("/api/v1/admin/media/{media_id}"),
            None,
            Some(&cookie),
            Some(&csrf),
            true
        )
        .await
        .0,
        409
    );
    let (status, _, published) = request(
        &app,
        "POST",
        &format!("{path}/status"),
        Some(json!({"status":"published","version":2})),
        Some(&cookie),
        Some(&csrf),
        true,
    )
    .await;
    assert_eq!(status, 200, "{published}");
    let first_published = published["data"]["published_at"].clone();
    let (status, _, public) =
        request(&app, "GET", "/api/v1/posts/first", None, None, None, false).await;
    assert_eq!(status, 200, "{public}");
    assert!(public["data"].get("version").is_none());
    assert!(public["data"].get("cover_media_id").is_none());
    assert_eq!(
        request(&app, "GET", &media_path, None, None, None, false)
            .await
            .0,
        200
    );
    assert_eq!(
        request(
            &app,
            "GET",
            "/api/v1/posts?status=draft",
            None,
            None,
            None,
            false
        )
        .await
        .0,
        400
    );
    for kind in ["project", "life"] {
        let mut v = content(kind, kind, None, vec![]);
        v["body_markdown"] = json!("正文");
        let (status, _, created) = request(
            &app,
            "POST",
            "/api/v1/admin/contents",
            Some(v),
            Some(&cookie),
            Some(&csrf),
            true,
        )
        .await;
        assert_eq!(status, 201, "{created}");
        let id = created["data"]["id"].as_str().unwrap();
        assert_eq!(
            request(
                &app,
                "POST",
                &format!("/api/v1/admin/contents/{id}/status"),
                Some(json!({"status":"published","version":1})),
                Some(&cookie),
                Some(&csrf),
                true
            )
            .await
            .0,
            200
        );
    }
    for endpoint in [
        "/api/v1/posts",
        "/api/v1/projects",
        "/api/v1/life",
        "/api/v1/categories?kind=blog",
        "/api/v1/tags?kind=blog",
        "/api/v1/admin/dashboard",
        "/api/v1/admin/media",
        "/api/v1/admin/categories",
        "/api/v1/admin/tags",
        "/sitemap.xml",
    ] {
        let (status, _, data) =
            request(&app, "GET", endpoint, None, Some(&cookie), None, false).await;
        assert_eq!(status, 200, "{endpoint}: {data}");
    }
    let event = json!({"event_id":uuid::Uuid::new_v4(),"page_path":"/posts/first","referrer_origin":"https://github.com"});
    let (status, headers, data) = request(
        &app,
        "POST",
        "/api/v1/analytics/pageviews",
        Some(event.clone()),
        None,
        None,
        true,
    )
    .await;
    assert_eq!(status, 204, "{data}");
    let visitor = headers["set-cookie"]
        .to_str()
        .unwrap()
        .split(';')
        .next()
        .unwrap()
        .to_owned();
    assert_eq!(
        request(
            &app,
            "POST",
            "/api/v1/analytics/pageviews",
            Some(event),
            Some(&visitor),
            None,
            true
        )
        .await
        .0,
        204
    );
    let (status, _, analytics) = request(
        &app,
        "GET",
        "/api/v1/admin/analytics",
        None,
        Some(&cookie),
        None,
        false,
    )
    .await;
    assert_eq!(status, 200, "{analytics}");
    assert_eq!(analytics["data"]["pv"], 1);
    assert_eq!(analytics["data"]["uv"], 1);
    assert_eq!(analytics["data"]["series"].as_array().unwrap().len(), 7);
    let (status, _, visits) = request(
        &app,
        "GET",
        "/api/v1/admin/visits",
        None,
        Some(&cookie),
        None,
        false,
    )
    .await;
    assert_eq!(status, 200, "{visits}");
    assert_eq!(visits["meta"]["total"], 1);
    assert!(visits["data"][0].get("visitor_hash").is_none());

    // 同一访客跨两天访问：两日 PV=2，但区间 UV 仍为 1。
    sqlx::query("INSERT INTO visit_events(id,event_id,occurred_at,visitor_hash,hash_key_version,client_ip,region_id,region_label,page_path,page_title,content_id,source,device) SELECT $1,$2,occurred_at-interval '1 day',visitor_hash,hash_key_version,client_ip,region_id,region_label,page_path,page_title,content_id,source,device FROM visit_events LIMIT 1").bind(uuid::Uuid::new_v4()).bind(uuid::Uuid::new_v4()).execute(&pool).await.unwrap();
    let (status, _, cross_day) = request(
        &app,
        "GET",
        "/api/v1/admin/analytics?days=7",
        None,
        Some(&cookie),
        None,
        false,
    )
    .await;
    assert_eq!(status, 200);
    assert_eq!(cross_day["data"]["pv"], 2);
    assert_eq!(cross_day["data"]["uv"], 1);
    assert_eq!(
        cross_day["data"]["series"]
            .as_array()
            .unwrap()
            .iter()
            .map(|d| d["uv"].as_i64().unwrap())
            .sum::<i64>(),
        2
    );
    assert!(cross_day["data"]["average_duration_seconds"].is_null());
    assert!(cross_day["data"]["pv_change_percent"].is_null());
    assert_eq!(
        request(
            &app,
            "GET",
            "/api/v1/admin/analytics?days=8",
            None,
            Some(&cookie),
            None,
            false
        )
        .await
        .0,
        400
    );
    assert_eq!(
        request(
            &app,
            "POST",
            "/api/v1/analytics/pageviews",
            Some(json!({"event_id":uuid::Uuid::new_v4(),"page_path":"/","referrer_origin":null})),
            Some(&cookie),
            None,
            true
        )
        .await
        .0,
        204
    );
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM visit_events")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 2, "管理员预览不能计入访客事件");
    let rule = json!({"scope":"ip","ip":"127.0.0.1","region_id":null,"reason":"测试封锁","enabled":true,"duration_hours":1});
    let (status, _, data) = request(
        &app,
        "POST",
        "/api/v1/admin/access-rules",
        Some(rule.clone()),
        Some(&cookie),
        Some(&csrf),
        true,
    )
    .await;
    assert_eq!(status, 201, "{data}");
    let rule_id = data["data"]["id"].as_str().unwrap();
    assert_eq!(
        request(&app, "GET", "/api/v1/profile", None, None, None, false)
            .await
            .0,
        403
    );
    assert_eq!(
        request(
            &app,
            "GET",
            "/api/v1/admin/access-rules",
            None,
            Some(&cookie),
            None,
            false
        )
        .await
        .0,
        200
    );
    let forged = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/profile")
                .header("x-forwarded-for", "192.0.2.99")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(forged.status(), 403);
    cli::disable_rule(&state, uuid::Uuid::parse_str(rule_id).unwrap())
        .await
        .unwrap();
    assert_eq!(
        request(&app, "GET", "/api/v1/profile", None, None, None, false)
            .await
            .0,
        200
    );
    assert_eq!(
        request(
            &app,
            "POST",
            "/api/v1/admin/access-rules",
            Some(rule),
            Some(&cookie),
            Some(&csrf),
            true
        )
        .await
        .0,
        409
    );
    let mut region = json!({"scope":"region","ip":null,"region_id":"unknown","reason":"test","enabled":true,"duration_hours":null});
    assert_eq!(
        request(
            &app,
            "POST",
            "/api/v1/admin/access-rules",
            Some(region.take()),
            Some(&cookie),
            Some(&csrf),
            true
        )
        .await
        .0,
        503
    );
    assert_eq!(
        request(
            &app,
            "POST",
            &format!("{path}/status"),
            Some(json!({"status":"draft","version":3})),
            Some(&cookie),
            Some(&csrf),
            true
        )
        .await
        .0,
        200
    );
    assert_eq!(
        request(&app, "GET", &media_path, None, None, None, false)
            .await
            .0,
        404
    );
    let (status, _, republished) = request(
        &app,
        "POST",
        &format!("{path}/status"),
        Some(json!({"status":"published","version":4})),
        Some(&cookie),
        Some(&csrf),
        true,
    )
    .await;
    assert_eq!(status, 200);
    assert_eq!(republished["data"]["published_at"], first_published);
    assert_eq!(
        request(
            &app,
            "DELETE",
            &format!("{path}?version=5"),
            None,
            Some(&cookie),
            Some(&csrf),
            true
        )
        .await
        .0,
        409
    );
    assert_eq!(
        request(
            &app,
            "POST",
            &format!("{path}/status"),
            Some(json!({"status":"archived","version":5})),
            Some(&cookie),
            Some(&csrf),
            true
        )
        .await
        .0,
        200
    );
    assert_eq!(
        request(
            &app,
            "DELETE",
            &format!("{path}?version=6"),
            None,
            Some(&cookie),
            Some(&csrf),
            true
        )
        .await
        .0,
        204
    );
    assert_eq!(
        request(
            &app,
            "DELETE",
            &format!("/api/v1/admin/media/{media_id}"),
            None,
            Some(&cookie),
            Some(&csrf),
            true
        )
        .await
        .0,
        204
    );

    // 引用建立与媒体删除竞争：只能引用成功或删除成功，不能留下悬空关系。
    let race_media = upload_test_image(&app, &cookie, &csrf).await;
    let mut race_content = content("blog", "reference-race", None, vec![]);
    race_content["cover_media_id"] = json!(race_media);
    let media_delete = format!("/api/v1/admin/media/{race_media}");
    let (create, delete) = tokio::join!(
        request(
            &app,
            "POST",
            "/api/v1/admin/contents",
            Some(race_content),
            Some(&cookie),
            Some(&csrf),
            true
        ),
        request(
            &app,
            "DELETE",
            &media_delete,
            None,
            Some(&cookie),
            Some(&csrf),
            true
        )
    );
    assert!(
        matches!(
            (create.0.as_u16(), delete.0.as_u16()),
            (201, 409) | (422, 204)
        ),
        "create={:?}, delete={:?}",
        create,
        delete
    );
    // 已过期会话不能进入管理端，但不阻止公开阅读。
    use sha2::Digest;
    let expired_token = "e".repeat(64);
    let expired_cookie = format!("admin_session_dev={expired_token}");
    sqlx::query("INSERT INTO admin_sessions(id,admin_id,token_hash,csrf_token,created_at,last_seen_at,expires_at,absolute_expires_at) SELECT $1,id,$2,'expired',now()-interval '2 days',now()-interval '2 days',now()-interval '1 day',now()+interval '1 day' FROM admins").bind(uuid::Uuid::new_v4()).bind(sha2::Sha256::digest(expired_token.as_bytes()).to_vec()).execute(&pool).await.unwrap();
    assert_eq!(
        request(
            &app,
            "GET",
            "/api/v1/admin/profile",
            None,
            Some(&expired_cookie),
            None,
            false
        )
        .await
        .0,
        401
    );
    assert_eq!(
        request(
            &app,
            "GET",
            "/api/v1/profile",
            None,
            Some(&expired_cookie),
            None,
            false
        )
        .await
        .0,
        200
    );
    // 单连接池也能发布内容，事务内不能再从同一个池申请第二个连接。
    let mut single_config = config.clone();
    single_config.database_pool_size = 1;
    let single_state = AppState::new(&single_config).await.unwrap();
    let single = app::build_app(single_state.clone());
    let mut value = content("blog", "single-connection", None, vec![]);
    value["body_markdown"] = json!("单连接池正文");
    let (status, _, created) = request(
        &single,
        "POST",
        "/api/v1/admin/contents",
        Some(value),
        Some(&cookie),
        Some(&csrf),
        true,
    )
    .await;
    assert_eq!(status, 201);
    let id = created["data"]["id"].as_str().unwrap();
    assert_eq!(
        request(
            &single,
            "POST",
            &format!("/api/v1/admin/contents/{id}/status"),
            Some(json!({"status":"published","version":1})),
            Some(&cookie),
            Some(&csrf),
            true
        )
        .await
        .0,
        200
    );
    single_state.db.close().await;
    let events: i64 =
        sqlx::query_scalar("SELECT count(*) FROM visit_events WHERE content_id IS NULL")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(events, 2, "内容删除不能删除历史访问记录");

    // 只清理到期事件/汇总和超过 24 小时的孤立文件，保留近期文件。
    sqlx::query("INSERT INTO visit_events(id,event_id,occurred_at,visitor_hash,hash_key_version,client_ip,region_id,region_label,page_path,page_title,source,device) SELECT $1,$2,now()-interval '61 days',visitor_hash,hash_key_version,client_ip,region_id,region_label,page_path,page_title,source,device FROM visit_events LIMIT 1").bind(uuid::Uuid::new_v4()).bind(uuid::Uuid::new_v4()).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO analytics_daily(date,pv,uv) VALUES(current_date-400,0,0)")
        .execute(&pool)
        .await
        .unwrap();
    let orphan = root.join(format!("2020/01/{}/original.webp", uuid::Uuid::new_v4()));
    tokio::fs::create_dir_all(orphan.parent().unwrap())
        .await
        .unwrap();
    tokio::fs::write(&orphan, b"orphan").await.unwrap();
    let old = std::time::SystemTime::now() - std::time::Duration::from_secs(172800);
    std::fs::File::options()
        .write(true)
        .open(&orphan)
        .unwrap()
        .set_times(std::fs::FileTimes::new().set_modified(old))
        .unwrap();
    let recent = orphan.parent().unwrap().join("thumb.webp");
    tokio::fs::write(&recent, b"recent").await.unwrap();
    let operator_file = root.join("operator-config.json");
    tokio::fs::write(&operator_file, b"{}").await.unwrap();
    std::fs::File::options()
        .write(true)
        .open(&operator_file)
        .unwrap()
        .set_times(std::fs::FileTimes::new().set_modified(old))
        .unwrap();
    let report = cli::maintenance(&state, false).await.unwrap();
    assert_eq!(report["old_orphan_files"], 1);
    assert!(orphan.exists());
    let report = cli::maintenance(&state, true).await.unwrap();
    assert_eq!(report["old_orphan_files"], 1);
    assert!(!orphan.exists());
    assert!(recent.exists());
    assert!(
        operator_file.exists(),
        "孤立媒体清理不能删除非媒体的运维配置"
    );
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM visit_events")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 2);
    let count: i64 =
        sqlx::query_scalar("SELECT count(*) FROM analytics_daily WHERE date<current_date-364")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(count, 0);
    // 带本地归属地数据源的实例验证区域封锁与内部代理检查。
    let geo = root.join("regions.json");
    tokio::fs::write(&geo,json!([{"cidr":"127.0.0.1/32","region_id":"test-local","label":"测试区域","lookup_code":"test-local","network_label":null}]).to_string()).await.unwrap();
    let mut regional_config = config.clone();
    regional_config.geoip_file = Some(geo);
    regional_config.trusted_proxies = vec!["127.0.0.1/32".parse().unwrap()];
    let regional_state = AppState::new(&regional_config).await.unwrap();
    let regional = app::build_app(regional_state.clone());
    let(status,_,rule)=request(&regional,"POST","/api/v1/admin/access-rules",Some(json!({"scope":"region","ip":null,"region_id":"test-local","reason":"测试区域","enabled":true,"duration_hours":null})),Some(&cookie),Some(&csrf),true).await;
    assert_eq!(status, 201, "{rule}");
    assert_eq!(
        request(&regional, "GET", "/api/v1/profile", None, None, None, false)
            .await
            .0,
        403
    );
    assert_eq!(
        request(
            &regional,
            "GET",
            "/internal/access-check",
            None,
            None,
            None,
            false
        )
        .await
        .0,
        403
    );
    assert_eq!(
        request(
            &app,
            "GET",
            "/internal/access-check",
            None,
            None,
            None,
            false
        )
        .await
        .0,
        404
    );
    let target = rule["data"]["id"].as_str().unwrap();
    let disable = json!({"scope":"region","ip":null,"region_id":"test-local","reason":"已解除","enabled":false,"duration_hours":null,"version":1});
    assert_eq!(
        request(
            &regional,
            "PUT",
            &format!("/api/v1/admin/access-rules/{target}"),
            Some(disable),
            Some(&cookie),
            Some(&csrf),
            true
        )
        .await
        .0,
        200
    );
    assert_eq!(
        request(
            &regional,
            "GET",
            "/internal/access-check",
            None,
            None,
            None,
            false
        )
        .await
        .0,
        204
    );
    regional_state.db.close().await;

    assert_eq!(request(&app,"PUT","/api/v1/admin/password",Some(json!({"current_password":"correct test password","new_password":"new correct test password"})),Some(&cookie),Some(&csrf),true).await.0,204);
    assert_eq!(
        request(
            &app,
            "GET",
            "/api/v1/admin/profile",
            None,
            Some(&cookie),
            None,
            false
        )
        .await
        .0,
        401
    );

    let (status, _, session) = request(
        &app,
        "GET",
        "/api/v1/auth/session",
        None,
        Some(&cookie),
        None,
        false,
    )
    .await;
    assert_eq!(status, 200);
    assert_eq!(session["data"]["authenticated"], false);
    let (status, headers, login) = request(
        &app,
        "POST",
        "/api/v1/auth/login",
        Some(json!({"username":"owner","password":"new correct test password"})),
        None,
        None,
        true,
    )
    .await;
    assert_eq!(status, 200);
    let new_cookie = headers["set-cookie"]
        .to_str()
        .unwrap()
        .split(';')
        .next()
        .unwrap();
    let new_csrf = login["data"]["csrf_token"].as_str().unwrap();
    assert_eq!(
        request(
            &app,
            "POST",
            "/api/v1/auth/logout",
            None,
            Some(new_cookie),
            Some(new_csrf),
            true
        )
        .await
        .0,
        204
    );
    assert_eq!(
        request(
            &app,
            "GET",
            "/api/v1/admin/profile",
            None,
            Some(new_cookie),
            None,
            false
        )
        .await
        .0,
        401
    );
    cli::reset_password(&state, "reset correct test password".into())
        .await
        .unwrap();
    let linked: i64 =
        sqlx::query_scalar("SELECT count(*) FROM audit_logs WHERE request_id IS NOT NULL")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(linked > 5, "HTTP 管理审计应关联请求 ID");

    // 未知用户名的验证同样受真实客户端 IP 的失败窗口限制。
    for _ in 0..10 {
        assert_eq!(
            request(
                &app,
                "POST",
                "/api/v1/auth/login",
                Some(json!({"username":"does-not-exist","password":"wrong"})),
                None,
                None,
                true
            )
            .await
            .0,
            401
        );
    }
    let (status, headers, _) = request(
        &app,
        "POST",
        "/api/v1/auth/login",
        Some(json!({"username":"does-not-exist","password":"wrong"})),
        None,
        None,
        true,
    )
    .await;
    assert_eq!(status, 429);
    assert!(headers.contains_key("retry-after"));
    let audit: i64 = sqlx::query_scalar("SELECT count(*) FROM audit_logs")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(audit > 10);
    state.db.close().await;
    pool.close().await;
    tokio::fs::remove_dir_all(root).await.unwrap();
}

async fn upload_test_image(app: &Router, cookie: &str, csrf: &str) -> String {
    let mut png = Cursor::new(Vec::new());
    image::DynamicImage::new_rgb8(2, 2)
        .write_to(&mut png, image::ImageFormat::Png)
        .unwrap();
    let mut body=b"--race\r\nContent-Disposition: form-data; name=\"file\"; filename=\"test.png\"\r\nContent-Type: image/png\r\n\r\n".to_vec();
    body.extend(png.into_inner());
    body.extend(b"\r\n--race--\r\n");
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/admin/media")
                .header("content-type", "multipart/form-data; boundary=race")
                .header("cookie", cookie)
                .header("origin", "http://localhost:5173")
                .header("x-csrf-token", csrf)
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let bytes = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
    let value: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(status, 201, "{value}");
    value["data"]["id"].as_str().unwrap().into()
}
