use super::{dto::RuleInput, repository};
use crate::{
    common::validation,
    error::{AppError, AppResult},
    middleware::client_ip::normalize,
    modules::audit::service::record_audit_service,
    state::AppState,
};
use serde_json::Value;
use std::net::IpAddr;
use uuid::Uuid;
pub async fn denied_service(s: &AppState, ip: IpAddr, region: &str) -> AppResult<bool> {
    repository::denied_repository(&s.db, &normalize(ip).to_string(), region).await
}
pub async fn save_rule_service(
    s: &AppState,
    admin: Uuid,
    id: Option<Uuid>,
    value: Value,
) -> AppResult<Value> {
    let mut fields = vec![
        "scope",
        "ip",
        "region_id",
        "reason",
        "enabled",
        "duration_hours",
    ];
    if id.is_some() {
        fields.push("version");
    }
    validation::required(&value, &fields)?;
    let mut input: RuleInput =
        serde_json::from_value(value).map_err(|_| AppError::invalid("data", "字段类型错误"))?;
    input.reason = input.reason.trim().into();
    validation::text("reason", &input.reason, 1, 200)?;
    if input
        .duration_hours
        .is_some_and(|d| ![1, 24, 168].contains(&d))
    {
        return Err(AppError::invalid(
            "duration_hours",
            "仅允许 1、24、168 或 null",
        ));
    }
    match input.scope.as_str() {
        "ip" if input.ip.is_some() && input.region_id.is_none() => {
            let ip = input
                .ip
                .as_deref()
                .unwrap()
                .parse::<IpAddr>()
                .map_err(|_| AppError::invalid("ip", "仅接受单个 IPv4/IPv6 地址"))?;
            input.ip = Some(normalize(ip).to_string());
        }
        "region" if input.ip.is_none() && input.region_id.is_some() => {
            if !s.geo.available() {
                return Err(AppError::new(
                    axum::http::StatusCode::SERVICE_UNAVAILABLE,
                    "REGION_LOOKUP_UNAVAILABLE",
                    "未部署可靠的区域数据源",
                ));
            }
            let allowed =
                repository::blockable_region_repository(&s.db, input.region_id.as_deref()).await?;
            if allowed != Some(true) {
                return Err(AppError::invalid("region_id", "区域不存在或不可封锁"));
            }
        }
        _ => return Err(AppError::invalid("scope", "IP 和区域目标必须互斥")),
    }
    let target = id.unwrap_or_else(Uuid::new_v4);
    let mut tx = s.db.begin().await?;
    let mut preserve = false;
    if let Some(id) = id {
        let old = repository::lock_rule_repository(&mut tx, id).await?;
        if Some(old.version) != input.version {
            return Err(AppError::conflict());
        }
        if old.scope != input.scope || old.ip != input.ip || old.region_id != input.region_id {
            return Err(AppError::invalid("target", "规则目标创建后不可修改"));
        }
        preserve = !input.enabled;
    }
    let expires = input
        .duration_hours
        .map(|h| s.clock.now() + chrono::Duration::hours(i64::from(h)));
    let result =
        repository::save_rule_repository(&mut tx, target, id.is_none(), &input, preserve, expires)
            .await;
    if matches!(&result,Err(sqlx::Error::Database(e)) if e.is_unique_violation()) {
        return Err(AppError::new(
            axum::http::StatusCode::CONFLICT,
            "RULE_CONFLICT",
            "该目标已有规则",
        ));
    }
    result?;
    record_audit_service(
        &mut tx,
        Some(admin),
        if id.is_some() {
            "access.update"
        } else {
            "access.create"
        },
        "access_rule",
        &target.to_string(),
    )
    .await?;
    tx.commit().await?;
    repository::rule_repository(&s.db, target).await
}
pub async fn delete_rule_service(
    s: &AppState,
    admin: Uuid,
    id: Uuid,
    version: i32,
) -> AppResult<()> {
    let mut tx = s.db.begin().await?;
    let old = repository::lock_rule_repository(&mut tx, id).await?;
    if old.version != version {
        return Err(AppError::conflict());
    }
    repository::delete_rule_repository(&mut tx, id).await?;
    record_audit_service(
        &mut tx,
        Some(admin),
        "access.delete",
        "access_rule",
        &id.to_string(),
    )
    .await?;
    tx.commit().await?;
    Ok(())
}
pub async fn disable_rule_service(s: &AppState, id: Uuid) -> AppResult<()> {
    let mut tx = s.db.begin().await?;
    repository::lock_rule_repository(&mut tx, id).await?;
    repository::disable_rule_repository(&mut tx, id).await?;
    record_audit_service(
        &mut tx,
        None,
        "access.disable.cli",
        "access_rule",
        &id.to_string(),
    )
    .await?;
    tx.commit().await?;
    Ok(())
}
