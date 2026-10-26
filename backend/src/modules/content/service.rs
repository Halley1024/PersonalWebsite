use super::{
    dto::{ContentInput, StatusInput},
    markdown, repository,
};
use crate::{
    common::validation,
    error::{AppError, AppResult},
    modules::{audit::service::record_audit_service, media::service::lock_media_service},
    state::AppState,
};
use serde_json::{Value, json};
use uuid::Uuid;
const EDIT_FIELDS: &[&str] = &[
    "title",
    "excerpt",
    "body_markdown",
    "cover_media_id",
    "category_id",
    "tag_ids",
    "featured",
    "sort_order",
    "seo_title",
    "seo_description",
    "gallery",
    "project",
    "life",
];
fn parse(mut value: Value, create: bool) -> AppResult<ContentInput> {
    let mut fields = EDIT_FIELDS.to_vec();
    if create {
        fields.extend(["kind", "slug"]);
    } else {
        fields.push("version");
    }
    validation::required(&value, &fields)?;
    for key in ["title", "excerpt"] {
        if let Some(s) = value[key].as_str() {
            value[key] = json!(s.trim());
        }
    }
    if let Some(p) = value.get("project").filter(|p| !p.is_null()) {
        validation::required(
            p,
            &[
                "tech_stack",
                "project_stage",
                "started_on",
                "ended_on",
                "repository_url",
                "demo_url",
            ],
        )?;
    }
    if let Some(l) = value.get("life").filter(|p| !p.is_null()) {
        validation::required(l, &["occurred_on", "location_label"])?;
    }
    serde_json::from_value(value).map_err(|_| AppError::invalid("data", "字段类型错误"))
}
fn validate(kind: &str, i: &ContentInput, published: bool) -> AppResult<Vec<Uuid>> {
    validation::kind(kind)?;
    validation::text("title", &i.title, 1, 120)?;
    validation::text("excerpt", &i.excerpt, 1, 300)?;
    validation::text("body_markdown", &i.body_markdown, 0, 200000)?;
    if i.slug.as_ref().is_some_and(|slug| !validation::slug(slug)) {
        return Err(AppError::invalid("slug", "slug 格式无效"));
    }
    for (k, v, max) in [
        ("seo_title", &i.seo_title, 70),
        ("seo_description", &i.seo_description, 160),
    ] {
        if let Some(v) = v {
            validation::text(k, v, 1, max)?;
        }
    }
    let unique_tags: std::collections::HashSet<_> = i.tag_ids.iter().collect();
    if i.tag_ids.len() > 10 || unique_tags.len() != i.tag_ids.len() {
        return Err(AppError::invalid("tag_ids", "最多 10 个且不能重复"));
    }
    let mut gallery_ids = std::collections::HashSet::new();
    if i.gallery.len() > 20 {
        return Err(AppError::invalid("gallery", "最多 20 张"));
    }
    for (pos, g) in i.gallery.iter().enumerate() {
        if g.position != pos as i32 || !gallery_ids.insert(g.media_id) {
            return Err(AppError::invalid(
                "gallery",
                "图片不能重复，位置应从 0 连续递增",
            ));
        }
        validation::text("gallery.alt", &g.alt, 0, 200)?;
    }
    match (kind, &i.project, &i.life) {
        ("blog", None, None) if i.gallery.is_empty() => {}
        ("project", Some(p), None) => {
            if !["idea", "building", "maintained", "completed"].contains(&p.project_stage.as_str())
                || p.ended_on.is_some_and(|e| e < p.started_on)
                || p.tech_stack.len() > 20
            {
                return Err(AppError::invalid("project", "项目阶段、日期或技术栈无效"));
            }
            for t in &p.tech_stack {
                validation::text("tech_stack", t, 1, 50)?;
            }
            for (k, u) in [
                ("repository_url", &p.repository_url),
                ("demo_url", &p.demo_url),
            ] {
                if let Some(u) = u {
                    validation::url(k, u, false)?;
                }
            }
        }
        ("life", None, Some(l)) => {
            if let Some(v) = &l.location_label {
                validation::text("location_label", v, 0, 100)?;
            }
        }
        _ => return Err(AppError::invalid("kind", "内容类型与扩展字段或相册不匹配")),
    }
    if published
        && ((kind != "life" && i.body_markdown.trim().is_empty())
            || (kind == "life" && i.body_markdown.trim().is_empty() && i.gallery.is_empty()))
    {
        return Err(AppError::invalid("body_markdown", "发布内容不能为空"));
    }
    markdown::media_ids(&i.body_markdown)
}
pub fn public_content(mut v: Value, detail: bool) -> Value {
    let kind = v["kind"].as_str().unwrap_or_default().to_owned();
    if let Some(p) = v["project"].as_object().cloned() {
        for k in ["tech_stack", "project_stage", "started_on", "ended_on"] {
            v[k] = p[k].clone();
        }
    }
    if let Some(l) = v["life"].as_object().cloned() {
        v["occurred_on"] = l["occurred_on"].clone();
        v["location_label"] = l["location_label"].clone();
    }
    if detail && let Some(gallery) = v["gallery"].as_array_mut() {
        for g in gallery {
            let alt = g["alt"].as_str().unwrap_or_default();
            let alt = if alt.is_empty() {
                g["media"]["alt"].as_str().unwrap_or_default()
            } else {
                alt
            }
            .to_owned();
            *g = json!({"media":g["media"],"alt":alt,"position":g["position"]});
        }
    }
    let object = v.as_object_mut().expect("repository 返回对象");
    for key in [
        "status",
        "version",
        "created_at",
        "cover_media_id",
        "category_id",
        "tag_ids",
        "sort_order",
    ] {
        object.remove(key);
    }
    if !detail {
        object.remove("project");
        object.remove("life");
    } else {
        if kind != "project" {
            object.insert("project".into(), Value::Null);
        }
        if kind != "life" {
            object.insert("life".into(), Value::Null);
        }
    }
    v
}
pub async fn save_content_service(
    s: &AppState,
    admin: Uuid,
    id: Option<Uuid>,
    value: Value,
) -> AppResult<Value> {
    let input = parse(value, id.is_none())?;
    let target = id.unwrap_or_else(Uuid::new_v4);
    let old = if id.is_some() {
        Some(repository::find_detail_repository(&s.db, id, None, None, false).await?)
    } else {
        None
    };
    let kind = if let Some(old) = &old {
        old["kind"].as_str().ok_or_else(AppError::internal)?
    } else {
        input.kind.as_deref().ok_or_else(AppError::bad)?
    };
    let body_ids = validate(
        kind,
        &input,
        old.as_ref().is_some_and(|v| v["status"] == "published"),
    )?;
    let mut media = body_ids.clone();
    media.extend(input.cover_media_id);
    media.extend(input.gallery.iter().map(|g| g.media_id));
    if id.is_some() {
        media.extend(repository::media_ids_repository(&s.db, target).await?);
    }
    let mut tx = s.db.begin().await?;
    lock_media_service(&mut tx, &media).await?;
    if id.is_some() {
        let identity = repository::lock_content_repository(&mut tx, target).await?;
        if Some(identity.version) != input.version
            || old
                .as_ref()
                .is_some_and(|v| v["version"].as_i64() != input.version.map(i64::from))
        {
            return Err(AppError::conflict());
        }
        if identity.status == "archived" {
            return Err(AppError::new(
                axum::http::StatusCode::CONFLICT,
                "INVALID_STATE",
                "归档内容必须先恢复草稿",
            ));
        }
    }
    repository::validate_relations_repository(&mut tx, kind, input.category_id, &input.tag_ids)
        .await?;
    repository::save_content_repository(&mut tx, target, kind, id.is_none(), &input, &body_ids)
        .await?;
    record_audit_service(
        &mut tx,
        Some(admin),
        if id.is_some() {
            "content.update"
        } else {
            "content.create"
        },
        "content",
        &target.to_string(),
    )
    .await?;
    tx.commit().await?;
    repository::find_detail_repository(&s.db, Some(target), None, None, false).await
}
pub fn transition(from: &str, to: &str) -> bool {
    matches!(
        (from, to),
        ("draft", "published")
            | ("draft", "archived")
            | ("published", "draft")
            | ("published", "archived")
            | ("archived", "draft")
    )
}
pub async fn change_status_service(
    s: &AppState,
    admin: Uuid,
    id: Uuid,
    input: StatusInput,
) -> AppResult<Value> {
    let old = repository::find_detail_repository(&s.db, Some(id), None, None, false).await?;
    let media = repository::media_ids_repository(&s.db, id).await?;
    let mut tx = s.db.begin().await?;
    lock_media_service(&mut tx, &media).await?;
    let identity = repository::lock_content_repository(&mut tx, id).await?;
    if identity.version != input.version || old["version"] != input.version {
        return Err(AppError::conflict());
    }
    if !transition(&identity.status, &input.status) {
        return Err(AppError::new(
            axum::http::StatusCode::CONFLICT,
            "INVALID_STATE",
            "不允许的状态转换",
        ));
    }
    if input.status == "published" {
        let mut value = serde_json::Map::new();
        for k in EDIT_FIELDS {
            value.insert((*k).into(), old[*k].clone());
        }
        value.insert("version".into(), json!(input.version));
        // 管理详情中的图库可能附有只读媒体摘要，写入校验只使用三个输入字段。
        if let Some(g) = value.get_mut("gallery").and_then(Value::as_array_mut) {
            for item in g {
                item.as_object_mut().unwrap().remove("media");
            }
        }
        let parsed = parse(Value::Object(value), false)?;
        validate(&identity.kind, &parsed, true)?;
    }
    repository::status_repository(&mut tx, id, &input.status).await?;
    record_audit_service(
        &mut tx,
        Some(admin),
        "content.status",
        "content",
        &id.to_string(),
    )
    .await?;
    tx.commit().await?;
    repository::find_detail_repository(&s.db, Some(id), None, None, false).await
}
pub async fn delete_content_service(
    s: &AppState,
    admin: Uuid,
    id: Uuid,
    version: i32,
) -> AppResult<()> {
    let media = repository::media_ids_repository(&s.db, id).await?;
    let mut tx = s.db.begin().await?;
    lock_media_service(&mut tx, &media).await?;
    let c = repository::lock_content_repository(&mut tx, id).await?;
    if c.version != version {
        return Err(AppError::conflict());
    }
    if c.status == "published" {
        return Err(AppError::new(
            axum::http::StatusCode::CONFLICT,
            "INVALID_STATE",
            "已发布内容需先下线",
        ));
    }
    repository::delete_repository(&mut tx, id).await?;
    record_audit_service(
        &mut tx,
        Some(admin),
        "content.delete",
        "content",
        &id.to_string(),
    )
    .await?;
    tx.commit().await?;
    Ok(())
}

pub async fn sitemap_service(s: &AppState) -> AppResult<Vec<(String, String)>> {
    repository::sitemap_repository(&s.db).await
}

#[cfg(test)]
mod tests {
    use super::transition;
    #[test]
    fn content_state_machine() {
        for (from, to) in [
            ("draft", "published"),
            ("draft", "archived"),
            ("published", "draft"),
            ("published", "archived"),
            ("archived", "draft"),
        ] {
            assert!(transition(from, to));
        }
        for (from, to) in [
            ("archived", "published"),
            ("published", "published"),
            ("draft", "draft"),
            ("unknown", "draft"),
        ] {
            assert!(!transition(from, to));
        }
    }
}
