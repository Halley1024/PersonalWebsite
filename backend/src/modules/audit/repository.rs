use super::model::AuditEntry;
use crate::error::AppResult;
use sqlx::{Postgres, Transaction};

/// 使用 service 传入的事务，不独立提交。
pub async fn insert_audit_repository(
    tx: &mut Transaction<'_, Postgres>,
    entry: AuditEntry<'_>,
) -> AppResult<()> {
    sqlx::query("INSERT INTO audit_logs(id,admin_id,action,resource_type,resource_id,request_id) VALUES($1,$2,$3,$4,$5,$6)")
        .bind(entry.id).bind(entry.admin_id).bind(entry.action).bind(entry.resource_type).bind(entry.resource_id).bind(entry.request_id)
        .execute(&mut **tx).await?;
    Ok(())
}
