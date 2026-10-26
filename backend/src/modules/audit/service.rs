use super::{model::AuditEntry, repository};
use crate::error::AppResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn record_audit_service(
    tx: &mut Transaction<'_, Postgres>,
    admin_id: Option<Uuid>,
    action: &str,
    resource_type: &str,
    resource_id: &str,
) -> AppResult<()> {
    repository::insert_audit_repository(
        tx,
        AuditEntry {
            id: Uuid::new_v4(),
            admin_id,
            action,
            resource_type,
            resource_id,
            request_id: crate::middleware::request_id::REQUEST_ID
                .try_with(Clone::clone)
                .ok(),
        },
    )
    .await
}
