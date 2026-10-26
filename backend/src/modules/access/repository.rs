use super::{dto::RulesQuery, model::RuleIdentity};
use crate::{
    common::pagination::literal_like,
    error::{AppError, AppResult},
};
use serde_json::Value;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;
const VIEW: &str = "jsonb_build_object('id',a.id,'scope',a.scope,'target',CASE WHEN a.scope='ip' THEN host(a.ip) ELSE a.region_id END,'target_label',CASE WHEN a.scope='ip' THEN host(a.ip) ELSE r.label END,'action',a.action,'reason',a.reason,'enabled',a.enabled,'duration_hours',a.duration_hours,'created_at',a.created_at,'updated_at',a.updated_at,'expires_at',a.expires_at,'version',a.version,'effective',a.enabled AND (a.expires_at IS NULL OR a.expires_at>now()))";
pub async fn denied_repository(pool: &PgPool, ip: &str, region: &str) -> AppResult<bool> {
    Ok(sqlx::query_scalar(
        r#"
            SELECT EXISTS(
            SELECT 1 
            FROM access_rules 
            WHERE enabled 
            AND (expires_at IS NULL OR expires_at>now()) 
            AND (ip=$1::inet OR region_id=$2))
            "#,
    )
    .bind(ip)
    .bind(region)
    .fetch_one(pool)
    .await?)
}
pub async fn regions_repository(pool: &PgPool) -> AppResult<Vec<Value>> {
    let rows:Vec<(Value,)>=sqlx::query_as("SELECT jsonb_build_object('id',id,'label',label,'blockable',blockable) FROM region_catalog ORDER BY id").fetch_all(pool).await?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}
pub async fn list_rules_repository(
    pool: &PgPool,
    q: &RulesQuery,
    size: i64,
    offset: i64,
) -> AppResult<(Vec<Value>, i64)> {
    let filter = "WHERE ($1::text IS NULL OR a.scope=$1) AND ($2::text IS NULL OR CASE WHEN NOT a.enabled THEN 'disabled' WHEN a.expires_at IS NOT NULL AND a.expires_at<=now() THEN 'expired' ELSE 'active' END=$2) AND ($3::text IS NULL OR host(a.ip) ILIKE $3 OR r.label ILIKE $3 OR a.reason ILIKE $3)";
    let pattern = q.q.as_deref().map(literal_like);
    let mut tx = pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *tx)
        .await?;
    let total:i64=sqlx::query_scalar(&format!("SELECT count(*) FROM access_rules a LEFT JOIN region_catalog r ON r.id=a.region_id {filter}")).bind(&q.scope).bind(&q.state).bind(&pattern).fetch_one(&mut *tx).await?;
    let rows:Vec<(Value,)>=sqlx::query_as(&format!("SELECT {VIEW} FROM access_rules a LEFT JOIN region_catalog r ON r.id=a.region_id {filter} ORDER BY a.created_at DESC,a.id DESC LIMIT $4 OFFSET $5")).bind(&q.scope).bind(&q.state).bind(&pattern).bind(size).bind(offset).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok((rows.into_iter().map(|r| r.0).collect(), total))
}
pub async fn lock_rule_repository(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
) -> AppResult<RuleIdentity> {
    sqlx::query_as(
        "SELECT scope,host(ip) AS ip,region_id,version FROM access_rules WHERE id=$1 FOR UPDATE",
    )
    .bind(id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(AppError::missing)
}
pub async fn rule_repository(pool: &PgPool, id: Uuid) -> AppResult<Value> {
    let v:(Value,)=sqlx::query_as(&format!("SELECT {VIEW} FROM access_rules a LEFT JOIN region_catalog r ON r.id=a.region_id WHERE a.id=$1")).bind(id).fetch_one(pool).await?;
    Ok(v.0)
}

pub async fn blockable_region_repository(
    pool: &PgPool,
    id: Option<&str>,
) -> AppResult<Option<bool>> {
    Ok(
        sqlx::query_scalar("SELECT blockable FROM region_catalog WHERE id=$1")
            .bind(id)
            .fetch_optional(pool)
            .await?,
    )
}
pub async fn save_rule_repository(
    tx: &mut Transaction<'_, Postgres>,
    target: Uuid,
    create: bool,
    input: &super::dto::RuleInput,
    preserve: bool,
    expires: Option<chrono::DateTime<chrono::Utc>>,
) -> Result<(), sqlx::Error> {
    if create {
        sqlx::query("INSERT INTO access_rules(id,scope,ip,region_id,reason,enabled,duration_hours,expires_at) VALUES($1,$2,$3::inet,$4,$5,$6,$7,$8)").bind(target).bind(&input.scope).bind(&input.ip).bind(&input.region_id).bind(&input.reason).bind(input.enabled).bind(input.duration_hours).bind(expires).execute(&mut **tx).await?;
    } else {
        sqlx::query(r#"
            UPDATE access_rules 
            SET reason=$1,enabled=$2,duration_hours=CASE WHEN $3 THEN duration_hours ELSE $4 END,expires_at=CASE WHEN $3 THEN expires_at ELSE $5 END,updated_at=now(),version=version+1 
            WHERE id=$6
            "#).bind(&input.reason).bind(input.enabled).bind(preserve).bind(input.duration_hours).bind(expires).bind(target).execute(&mut **tx).await?;
    }
    Ok(())
}
pub async fn delete_rule_repository(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> AppResult<()> {
    sqlx::query("DELETE FROM access_rules WHERE id=$1")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}
pub async fn disable_rule_repository(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
) -> AppResult<()> {
    sqlx::query(
        "UPDATE access_rules SET enabled=false,version=version+1,updated_at=now() WHERE id=$1",
    )
    .bind(id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
