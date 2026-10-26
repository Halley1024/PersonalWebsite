use super::model::{Admin, Session};
use chrono::{DateTime, Utc};
use sqlx::PgPool;
pub async fn find_admin_repository(
    pool: &PgPool,
    username: &str,
) -> Result<Option<Admin>, sqlx::Error> {
    sqlx::query_as("SELECT id,username,password_hash FROM admins WHERE username=$1")
        .bind(username)
        .fetch_optional(pool)
        .await
}
pub async fn find_session_repository(
    pool: &PgPool,
    hash: &[u8],
    now: DateTime<Utc>,
    idle_hours: i64,
) -> Result<Option<Session>, sqlx::Error> {
    // 验证与必要的滑动更新在同一条语句执行，绝对期限不可延长。
    sqlx::query_as(r#"WITH current AS (
      UPDATE admin_sessions SET
        expires_at=CASE WHEN last_seen_at <= $2 - interval '5 minutes' THEN LEAST($2 + make_interval(hours => $3),absolute_expires_at) ELSE expires_at END,
        last_seen_at=CASE WHEN last_seen_at <= $2 - interval '5 minutes' THEN $2 ELSE last_seen_at END
      WHERE token_hash=$1 AND expires_at>$2 AND absolute_expires_at>$2
      RETURNING id,admin_id,csrf_token,expires_at)
      SELECT current.*,admins.username FROM current JOIN admins ON admins.id=current.admin_id"#)
      .bind(hash).bind(now).bind(idle_hours as i32).fetch_optional(pool).await
}

// 写操作接收 service 持有的事务，不能在 repository 内独立提交。
pub async fn lock_password_repository(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    id: uuid::Uuid,
) -> Result<String, sqlx::Error> {
    sqlx::query_scalar("SELECT password_hash FROM admins WHERE id=$1 FOR UPDATE")
        .bind(id)
        .fetch_one(&mut **tx)
        .await
}
pub async fn update_password_repository(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    id: uuid::Uuid,
    hash: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE admins SET password_hash=$1,updated_at=now() WHERE id=$2")
        .bind(hash)
        .bind(id)
        .execute(&mut **tx)
        .await?;
    sqlx::query("DELETE FROM admin_sessions WHERE admin_id=$1")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}
pub async fn insert_admin_repository(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    id: uuid::Uuid,
    username: &str,
    hash: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO admins(id,username,password_hash) VALUES($1,$2,$3)")
        .bind(id)
        .bind(username)
        .bind(hash)
        .execute(&mut **tx)
        .await?;
    Ok(())
}
pub async fn sole_admin_repository(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
) -> Result<Option<uuid::Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM admins FOR UPDATE")
        .fetch_optional(&mut **tx)
        .await
}
pub async fn insert_session_repository(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    data: super::model::NewSession,
) -> Result<(), sqlx::Error> {
    sqlx::query(r#"
            INSERT INTO admin_sessions(id,admin_id,token_hash,csrf_token,created_at,last_seen_at,expires_at,absolute_expires_at) 
            VALUES($1,$2,$3,$4,$5,$5,$6,$7)
            "#).bind(data.id).bind(data.admin_id).bind(data.token_hash).bind(data.csrf_token).bind(data.created_at).bind(data.expires_at).bind(data.absolute_expires_at).execute(&mut **tx).await?;
    Ok(())
}
pub async fn revoke_session_repository(pool: &PgPool, id: uuid::Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM admin_sessions WHERE id=$1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
