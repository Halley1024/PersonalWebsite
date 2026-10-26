use crate::{
    error::AppResult,
    modules::{access, auth, media},
    state::AppState,
};
use uuid::Uuid;
pub async fn create_admin(
    state: &AppState,
    username: String,
    password: String,
) -> Result<(), String> {
    auth::service::create_admin_service(state, username, password)
        .await
        .map_err(|e| e.message.to_owned())
}
pub async fn reset_password(state: &AppState, password: String) -> Result<(), String> {
    auth::service::reset_password_service(state, password)
        .await
        .map_err(|e| e.message.to_owned())
}
pub async fn disable_rule(state: &AppState, id: Uuid) -> Result<(), String> {
    access::service::disable_rule_service(state, id)
        .await
        .map_err(|e| e.message.to_owned())
}
pub async fn maintenance(state: &AppState, cleanup: bool) -> Result<serde_json::Value, String> {
    maintenance_service(state, cleanup)
        .await
        .map_err(|e| e.message.to_owned())
}
async fn maintenance_service(s: &AppState, cleanup: bool) -> AppResult<serde_json::Value> {
    let (sessions, events, audit) =
        crate::modules::analytics::repository::maintenance_records_repository(&s.db, s.clock.now())
            .await?;
    let mut temporary = 0;
    let mut directory = tokio::fs::read_dir(s.config.media_root.join(".tmp")).await?;
    while let Some(entry) = directory.next_entry().await? {
        let meta = entry.metadata().await?;
        if meta.is_file()
            && !entry.file_type().await?.is_symlink()
            && meta
                .modified()
                .ok()
                .and_then(|t| t.elapsed().ok())
                .is_some_and(|d| d.as_secs() > 86400)
        {
            temporary += 1;
            if cleanup {
                tokio::fs::remove_file(entry.path()).await?;
            }
        }
    }
    // 已标记 deleting 的媒体可以安全恢复重试；不自动删除正常 unused 媒体。
    let deleting = media::repository::deleting_ids_repository(&s.db).await?;
    if cleanup {
        for id in &deleting {
            media::service::delete_media_service(s, *id, None).await?;
        }
    }

    // 延迟扫描未入库文件；隐藏密钥文件和符号链接不参与扫描。
    let keys = media::repository::storage_keys_repository(&s.db).await?;
    let mut queue = vec![s.config.media_root.clone()];
    let mut orphans = 0u64;
    while let Some(path) = queue.pop() {
        let mut entries = tokio::fs::read_dir(path).await?;
        while let Some(entry) = entries.next_entry().await? {
            if entry.file_name().to_string_lossy().starts_with('.') {
                continue;
            }
            let file_type = entry.file_type().await?;
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                queue.push(entry.path());
                continue;
            }
            let meta = entry.metadata().await?;
            let full = entry.path();
            let key = full
                .strip_prefix(&s.config.media_root)
                .map_err(|_| crate::error::AppError::internal())?
                .to_string_lossy()
                .into_owned();
            if file_type.is_file()
                && crate::storage::local::is_managed_media_key(&key)
                && !keys.contains(&key)
                && meta
                    .modified()
                    .ok()
                    .and_then(|t| t.elapsed().ok())
                    .is_some_and(|d| d.as_secs() > 86400)
            {
                // 清理前复查数据库，防止扫描期间新入库。
                if !media::repository::key_exists_repository(&s.db, &key).await? {
                    orphans += 1;
                    if cleanup {
                        crate::storage::local::remove(&s.config.media_root, &key).await?;
                    }
                }
            }
        }
    }
    Ok(
        serde_json::json!({"expired_sessions_removed":sessions,"expired_events_removed":events,"expired_audits_removed":audit,"old_temporary_files":temporary,"old_orphan_files":orphans,"deleting_media":deleting.len(),"media_cleanup_applied":cleanup}),
    )
}
