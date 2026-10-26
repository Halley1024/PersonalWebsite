use crate::error::{AppError, AppResult};
use std::path::{Component, Path, PathBuf};
pub fn path(root: &Path, key: &str) -> AppResult<PathBuf> {
    if key.is_empty()
        || Path::new(key)
            .components()
            .any(|c| !matches!(c, Component::Normal(_)))
    {
        return Err(AppError::missing());
    }
    Ok(root.join(key))
}
pub async fn read(root: &Path, key: &str) -> AppResult<Vec<u8>> {
    let full = path(root, key)?;
    let base = tokio::fs::canonicalize(root).await?;
    let resolved = tokio::fs::canonicalize(full)
        .await
        .map_err(|_| AppError::missing())?;
    if !resolved.starts_with(base) {
        return Err(AppError::missing());
    }
    Ok(tokio::fs::read(resolved).await?)
}
pub async fn remove(root: &Path, key: &str) -> AppResult<()> {
    let full = path(root, key)?;
    match tokio::fs::symlink_metadata(&full).await {
        Ok(m) if m.file_type().is_symlink() => Err(AppError::internal()),
        Ok(_) => {
            let base = tokio::fs::canonicalize(root).await?;
            if !tokio::fs::canonicalize(&full).await?.starts_with(base) {
                return Err(AppError::internal());
            }
            tokio::fs::remove_file(full).await?;
            Ok(())
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.into()),
    }
}
pub async fn write_atomic(root: &Path, key: &str, data: &[u8]) -> AppResult<()> {
    let full = path(root, key)?;
    let parent = full.parent().ok_or_else(AppError::internal)?;
    tokio::fs::create_dir_all(parent).await?;
    let base = tokio::fs::canonicalize(root).await?;
    if !tokio::fs::canonicalize(parent).await?.starts_with(base) {
        return Err(AppError::internal());
    }
    let temp = root.join(".tmp").join(uuid::Uuid::new_v4().to_string());
    tokio::fs::write(&temp, data).await?;
    if let Err(e) = tokio::fs::rename(&temp, full).await {
        let _ = tokio::fs::remove_file(temp).await;
        return Err(e.into());
    }
    Ok(())
}

/// 只将应用自己的年月/UUID/图片布局认作孤立媒体，不清理运维配置或其他文件。
pub fn is_managed_media_key(key: &str) -> bool {
    let parts: Vec<_> = key.split('/').collect();
    parts.len() == 4
        && parts[0].len() == 4
        && parts[0].bytes().all(|b| b.is_ascii_digit())
        && parts[1].len() == 2
        && parts[1].bytes().all(|b| b.is_ascii_digit())
        && matches!(parts[1].parse::<u8>(), Ok(1..=12))
        && uuid::Uuid::parse_str(parts[2]).is_ok()
        && [
            "original.webp",
            "thumb.webp",
            "original.png",
            "thumb.png",
            "original.jpg",
            "thumb.jpg",
        ]
        .contains(&parts[3])
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn storage_keys_cannot_escape_root() {
        let root = Path::new("/tmp/media");
        assert!(path(root, "2026/10/id/original.webp").is_ok());
        for key in ["", "../secret", "/etc/passwd", "images/../../secret"] {
            assert!(path(root, key).is_err());
        }
    }
}
