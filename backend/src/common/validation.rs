use crate::error::{AppError, AppResult};
use serde_json::Value;
pub fn text(field: &str, s: &str, min: usize, max: usize) -> AppResult<()> {
    let n = s.chars().count();
    if n < min || n > max || (min > 0 && s.trim().is_empty()) {
        return Err(AppError::invalid(field, "长度或内容不符合要求"));
    }
    Ok(())
}
pub fn slug(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 100
        && s.split('-').all(|x| {
            !x.is_empty()
                && x.bytes()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
        })
}
pub fn kind(s: &str) -> AppResult<()> {
    if ["blog", "project", "life"].contains(&s) {
        Ok(())
    } else {
        Err(AppError::bad())
    }
}
pub fn url(field: &str, s: &str, mailto: bool) -> AppResult<()> {
    let u = url::Url::parse(s).map_err(|_| AppError::invalid(field, "链接格式无效"))?;
    if s.len() > 2048
        || !((u.scheme() == "https"
            && u.host_str().is_some()
            && u.username().is_empty()
            && u.password().is_none())
            || (mailto && u.scheme() == "mailto" && !u.path().is_empty()))
    {
        return Err(AppError::invalid(
            field,
            "仅允许有效 HTTPS 链接，联系方式可使用 mailto",
        ));
    }
    Ok(())
}
pub fn required<'a>(
    v: &'a Value,
    fields: &[&str],
) -> AppResult<&'a serde_json::Map<String, Value>> {
    let o = v.as_object().ok_or_else(AppError::bad)?;
    if o.len() != fields.len() || fields.iter().any(|k| !o.contains_key(*k)) {
        return Err(AppError::invalid(
            "data",
            "必须完整提交字段，不能包含未知字段",
        ));
    }
    Ok(o)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn slug_is_ascii_and_segmented() {
        assert!(slug("rust-2026"));
        for value in ["", "Rust", "-rust", "rust--http", "../rust", "文章"] {
            assert!(!slug(value));
        }
    }
    #[test]
    fn links_reject_scripts_and_credentials() {
        assert!(url("url", "https://example.com/path", false).is_ok());
        assert!(url("url", "mailto:user@example.com", true).is_ok());
        for value in [
            "javascript:alert(1)",
            "http://example.com",
            "https://user:secret@example.com",
            "/relative",
        ] {
            assert!(url("url", value, false).is_err());
        }
    }
}
