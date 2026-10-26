use super::{dto::SettingsInput, repository};
use crate::{
    common::validation,
    error::{AppError, AppResult},
    modules::audit::service::record_audit_service,
    state::AppState,
};
use serde_json::Value;
use uuid::Uuid;
pub async fn get_settings_service(state: &AppState, admin: bool) -> AppResult<Value> {
    let record = repository::find_settings_repository(&state.db).await?;
    let (version, updated_at) = (record.version, record.updated_at);
    let mut v = serde_json::to_value(super::dto::PublicSettingsDto::from(record))
        .map_err(|_| AppError::internal())?;
    if admin {
        v["version"] = serde_json::json!(version);
        v["updated_at"] = serde_json::json!(updated_at);
    }

    Ok(v)
}
pub async fn update_settings_service(
    state: &AppState,
    admin: Uuid,
    value: Value,
) -> AppResult<Value> {
    validation::required(
        &value,
        &[
            "site_name",
            "site_description",
            "footer_text",
            "default_seo_title",
            "default_seo_description",
            "version",
        ],
    )?;
    let mut i: SettingsInput =
        serde_json::from_value(value).map_err(|_| AppError::invalid("data", "字段类型错误"))?;
    i.site_name = i.site_name.trim().into();
    for (k, s, min, max) in [
        ("site_name", i.site_name.as_str(), 1, 80),
        ("site_description", i.site_description.as_str(), 0, 300),
        ("footer_text", i.footer_text.as_str(), 0, 300),
    ] {
        validation::text(k, s, min, max)?;
    }
    for (k, v, max) in [
        ("default_seo_title", &i.default_seo_title, 70),
        ("default_seo_description", &i.default_seo_description, 160),
    ] {
        if let Some(v) = v {
            validation::text(k, v, 1, max)?;
        }
    }
    if i.version < 1 {
        return Err(AppError::bad());
    }
    let mut tx = state.db.begin().await?;
    if !repository::update_settings_repository(&mut tx, &i).await? {
        return Err(AppError::conflict());
    }
    record_audit_service(&mut tx, Some(admin), "settings.update", "settings", "1").await?;
    tx.commit().await?;
    get_settings_service(state, true).await
}
