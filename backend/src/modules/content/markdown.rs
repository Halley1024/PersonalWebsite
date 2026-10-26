use crate::error::{AppError, AppResult};
use pulldown_cmark::{Event, Parser, Tag};
use uuid::Uuid;
pub fn media_ids(markdown: &str) -> AppResult<Vec<Uuid>> {
    let mut ids = Vec::new();
    for e in Parser::new(markdown) {
        if let Event::Start(Tag::Image { dest_url, .. }) = e {
            let id = dest_url
                .strip_prefix("media:")
                .and_then(|s| Uuid::parse_str(s).ok())
                .ok_or_else(|| AppError::invalid("body_markdown", "图片必须引用 media:UUID"))?;
            ids.push(id);
        }
    }
    ids.sort();
    ids.dedup();
    Ok(ids)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn image_refs_are_parsed_not_guessed_from_text() {
        let id = Uuid::new_v4();
        let text = format!("![a](media:{id})\n![b](media:{id})\n`![code](media:invalid)`");
        assert_eq!(media_ids(&text).unwrap(), vec![id]);
        assert!(media_ids("![external](https://example.com/image.png)").is_err());
        assert!(media_ids("![invalid](media:not-a-uuid)").is_err());
    }
}
