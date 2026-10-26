use super::repository;
use crate::{
    common::validation,
    error::{AppError, AppResult},
    modules::audit::service::record_audit_service,
    state::AppState,
};
use serde_json::{Value, json};
use uuid::Uuid;
pub async fn save_taxonomy_service(
    s: &AppState,
    admin: Uuid,
    tags: bool,
    id: Option<Uuid>,
    mut v: Value,
) -> AppResult<Value> {
    let mut fields = vec!["name", "slug"];
    fields.push(if id.is_some() { "version" } else { "kind" });
    if !tags {
        fields.push("sort_order");
    }
    validation::required(&v, &fields)?;
    let name = v["name"]
        .as_str()
        .ok_or_else(AppError::bad)?
        .trim()
        .to_owned();
    validation::text("name", &name, 1, 50)?;
    v["name"] = json!(name);
    if !v["slug"].as_str().is_some_and(validation::slug) {
        return Err(AppError::invalid("slug", "slug 格式无效"));
    }
    if !tags
        && v["sort_order"]
            .as_i64()
            .and_then(|n| i32::try_from(n).ok())
            .is_none()
    {
        return Err(AppError::bad());
    }
    let mut tx = s.db.begin().await?;
    let table = repository::table(tags);
    let target = id.unwrap_or_else(Uuid::new_v4);
    if let Some(id) = id {
        let old = repository::get_taxonomy_repository(&mut tx, tags, id).await?;
        if old["version"] != v["version"] || v["version"].as_i64().is_none() {
            return Err(AppError::conflict());
        }
    } else {
        validation::kind(v["kind"].as_str().ok_or_else(AppError::bad)?)?;
    }
    repository::save_taxonomy_repository(&mut tx, tags, target, id.is_none(), &v).await?;
    record_audit_service(
        &mut tx,
        Some(admin),
        if id.is_some() {
            "taxonomy.update"
        } else {
            "taxonomy.create"
        },
        table,
        &target.to_string(),
    )
    .await?;
    let result = repository::get_taxonomy_repository(&mut tx, tags, target).await?;
    tx.commit().await?;
    Ok(result)
}
pub async fn delete_taxonomy_service(
    s: &AppState,
    admin: Uuid,
    tags: bool,
    id: Uuid,
    version: i32,
) -> AppResult<()> {
    let mut tx = s.db.begin().await?;
    let old = repository::get_taxonomy_repository(&mut tx, tags, id).await?;
    if version < 1 || old["version"] != version {
        return Err(AppError::conflict());
    }
    repository::delete_taxonomy_repository(&mut tx, tags, id).await?;
    record_audit_service(
        &mut tx,
        Some(admin),
        "taxonomy.delete",
        repository::table(tags),
        &id.to_string(),
    )
    .await?;
    tx.commit().await?;
    Ok(())
}
