use super::{
    dto::{LoginInput, PasswordInput},
    model::{AdminIdentity, Session},
    repository,
};
use crate::{
    common::validation,
    error::{AppError, AppResult},
    middleware::{limits, request_id::RequestContext},
    modules::audit::service::record_audit_service,
    state::AppState,
};
use argon2::{
    Algorithm, Argon2, Params, PasswordHasher, PasswordVerifier, Version,
    password_hash::{PasswordHash, SaltString},
};
use chrono::Duration;
use rand::{RngCore, rngs::OsRng};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use uuid::Uuid;
pub fn random_token() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    bytes.iter().map(|x| format!("{x:02x}")).collect()
}
pub fn hash_token(token: &str) -> Vec<u8> {
    Sha256::digest(token.as_bytes()).to_vec()
}
fn engine() -> Argon2<'static> {
    Argon2::new(
        Algorithm::Argon2id,
        Version::V0x13,
        Params::new(65536, 3, 1, None).expect("固定 Argon2 参数有效"),
    )
}
///
pub async fn hash_password_service(state: &AppState, password: String) -> AppResult<String> {
    password_length(&password, 8)?;
    let permit = state
        .crypto
        .clone()
        .acquire_owned()
        .await
        .map_err(|_| AppError::unavailable())?;
    tokio::task::spawn_blocking(move || {
        let _permit = permit;
        engine()
            .hash_password(password.as_bytes(), &SaltString::generate(&mut OsRng))
            .map(|h| h.to_string())
            .map_err(|_| AppError::internal())
    })
    .await
    .map_err(|_| AppError::internal())?
}

async fn verify(state: &AppState, password: String, hash: String) -> AppResult<bool> {
    let permit = state
        .crypto
        .clone()
        .acquire_owned()
        .await
        .map_err(|_| AppError::unavailable())?;
    tokio::task::spawn_blocking(move || {
        let _permit = permit;
        PasswordHash::new(&hash)
            .ok()
            .is_some_and(|h| engine().verify_password(password.as_bytes(), &h).is_ok())
    })
    .await
    .map_err(|_| AppError::internal())
}
pub fn cookie(state: &AppState, token: &str, seconds: i64) -> String {
    format!(
        "{}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={seconds}{}",
        state.config.session_cookie(),
        if state.config.production {
            "; Secure"
        } else {
            ""
        }
    )
}
pub async fn login_service(
    state: &AppState,
    ctx: &RequestContext,
    input: LoginInput,
) -> AppResult<(Value, String)> {
    validation::text("username", &input.username, 1, 64)?;
    password_length(&input.password, 1)?;
    let username = input.username.to_lowercase();
    let ip_key = format!("login:ip:{}", ctx.ip);
    let account_key = format!("login:account:{username}");
    limits::take(state, &ip_key, 10, 900)?;
    limits::take(state, &account_key, 20, 900)?;
    let admin = repository::find_admin_repository(&state.db, &username).await?;
    // 不存在账号也进行同成本密码计算，避免明显的账号时序枚举。
    let hash = admin
        .as_ref()
        .map(|a| a.password_hash.clone())
        .unwrap_or_else(|| state.dummy_password_hash.as_ref().clone());
    let valid = verify(state, input.password, hash.clone()).await?;
    let admin = admin.filter(|_| valid).ok_or_else(|| {
        AppError::new(
            axum::http::StatusCode::UNAUTHORIZED,
            "INVALID_CREDENTIALS",
            "用户名或密码错误",
        )
    })?;
    let mut tx = state.db.begin().await?;
    let current = repository::lock_password_repository(&mut tx, admin.id).await?;
    if current != hash {
        return Err(AppError::unauthenticated());
    }
    let now = state.clock.now();
    let absolute = now + Duration::days(state.config.session_max_days);
    let expires = (now + Duration::hours(state.config.session_idle_hours)).min(absolute);
    let token = random_token();
    let csrf = random_token();
    repository::insert_session_repository(
        &mut tx,
        super::model::NewSession {
            id: Uuid::new_v4(),
            admin_id: admin.id,
            token_hash: hash_token(&token),
            csrf_token: csrf.clone(),
            created_at: now,
            expires_at: expires,
            absolute_expires_at: absolute,
        },
    )
    .await?;
    tx.commit().await?;
    limits::clear(state, &ip_key);
    limits::clear(state, &account_key);
    tracing::info!(request_id=%ctx.request_id,admin_id=%admin.id,"管理员登录成功");
    Ok((
        json!({"admin":AdminIdentity{id:admin.id,username:admin.username},"csrf_token":csrf,"expires_at":expires}),
        cookie(state, &token, (expires - now).num_seconds()),
    ))
}
pub async fn change_password_service(
    state: &AppState,
    session: &Session,
    input: PasswordInput,
) -> AppResult<()> {
    password_length(&input.current_password, 1)?;
    let admin = repository::find_admin_repository(&state.db, &session.username)
        .await?
        .ok_or_else(AppError::unauthenticated)?;
    if !verify(state, input.current_password, admin.password_hash.clone()).await? {
        return Err(AppError::new(
            axum::http::StatusCode::UNAUTHORIZED,
            "INVALID_CREDENTIALS",
            "当前密码错误",
        ));
    }
    let hash = hash_password_service(state, input.new_password).await?;
    let mut tx = state.db.begin().await?;
    let current = repository::lock_password_repository(&mut tx, admin.id).await?;
    if current != admin.password_hash {
        return Err(AppError::conflict());
    }
    repository::update_password_repository(&mut tx, admin.id, &hash).await?;
    record_audit_service(
        &mut tx,
        Some(admin.id),
        "password.change",
        "admin",
        &admin.id.to_string(),
    )
    .await?;
    tx.commit().await?;
    Ok(())
}
/// 创建管理员
pub async fn create_admin_service(
    state: &AppState,
    username: String,
    password: String,
) -> AppResult<()> {
    let username = username.to_lowercase();
    validation::text("username", &username, 1, 64)?;
    let hash = hash_password_service(state, password).await?;
    let id = Uuid::new_v4();
    let mut tx = state.db.begin().await?;
    repository::insert_admin_repository(&mut tx, id, &username, &hash).await?;
    record_audit_service(&mut tx, Some(id), "admin.create", "admin", &id.to_string()).await?;
    tx.commit().await?;
    Ok(())
}
pub async fn reset_password_service(state: &AppState, password: String) -> AppResult<()> {
    let hash = hash_password_service(state, password).await?;
    let mut tx = state.db.begin().await?;
    let id = repository::sole_admin_repository(&mut tx)
        .await?
        .ok_or_else(AppError::missing)?;
    repository::update_password_repository(&mut tx, id, &hash).await?;
    record_audit_service(
        &mut tx,
        Some(id),
        "password.reset.cli",
        "admin",
        &id.to_string(),
    )
    .await?;
    tx.commit().await?;
    Ok(())
}

pub fn dummy_hash() -> Result<String, &'static str> {
    engine()
        .hash_password(
            b"dummy-login-verification-secret",
            &SaltString::generate(&mut OsRng),
        )
        .map(|h| h.to_string())
        .map_err(|_| "初始化密码验证失败")
}

pub async fn logout_service(state: &AppState, id: Uuid) -> AppResult<()> {
    repository::revoke_session_repository(&state.db, id).await?;
    Ok(())
}

fn password_length(password: &str, min: usize) -> AppResult<()> {
    let n = password.chars().count();
    if n < min || n > 128 {
        return Err(AppError::invalid("password", "密码长度不符合要求"));
    }
    Ok(())
}
