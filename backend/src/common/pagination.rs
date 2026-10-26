use crate::error::{AppError, AppResult};
pub fn bounds(
    page: Option<i64>,
    size: Option<i64>,
    default: i64,
    max: i64,
) -> AppResult<(i64, i64, i64)> {
    let (page, size) = (page.unwrap_or(1), size.unwrap_or(default));
    if page < 1 || size < 1 || size > max {
        return Err(AppError::bad());
    }
    let offset = (page - 1).checked_mul(size).ok_or_else(AppError::bad)?;
    Ok((page, size, offset))
}
pub fn literal_like(text: &str) -> String {
    format!(
        "%{}%",
        text.replace('\\', "\\\\")
            .replace('%', "\\%")
            .replace('_', "\\_")
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bounds_and_literal_search() {
        assert_eq!(bounds(None, None, 12, 50).unwrap(), (1, 12, 0));
        assert!(bounds(Some(0), None, 12, 50).is_err());
        assert!(bounds(Some(i64::MAX), Some(50), 12, 50).is_err());
        assert_eq!(literal_like("a%_\\b"), "%a\\%\\_\\\\b%");
    }
}
