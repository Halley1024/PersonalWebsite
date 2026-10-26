use crate::error::{AppError, AppResult};
use image::{GenericImageView, ImageFormat, ImageReader, Limits};
use std::io::Cursor;
pub struct Processed {
    pub original: Vec<u8>,  // 原图相对存储键或重编码内容。
    pub thumbnail: Vec<u8>, // 缩略图相对存储键或重编码内容。
    pub width: u32,         // 图像宽度，单位像素。
    pub height: u32,        // 图像高度，单位像素。
} // 重编码后不保留 EXIF/GPS。
pub fn process(bytes: &[u8]) -> AppResult<Processed> {
    let format = image::guess_format(bytes).map_err(|_| {
        AppError::new(
            axum::http::StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "UNSUPPORTED_MEDIA_TYPE",
            "仅支持 JPEG、PNG、WebP",
        )
    })?;
    if ![ImageFormat::Jpeg, ImageFormat::Png, ImageFormat::WebP].contains(&format) {
        return Err(AppError::new(
            axum::http::StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "UNSUPPORTED_MEDIA_TYPE",
            "图片格式不受支持",
        ));
    }
    let mut header = ImageReader::with_format(Cursor::new(bytes), format);
    header.limits(decode_limits());
    let (w, h) = header
        .into_dimensions()
        .map_err(|_| AppError::invalid("file", "图片损坏"))?;
    if w == 0 || h == 0 || w > 12000 || h > 12000 || u64::from(w) * u64::from(h) > 40000000 {
        return Err(AppError::invalid("file", "图片尺寸超出限制"));
    }
    let mut reader = ImageReader::with_format(Cursor::new(bytes), format);
    reader.limits(decode_limits());
    let image = reader
        .decode()
        .map_err(|_| AppError::invalid("file", "图片解码失败或资源超限"))?;
    let (width, height) = image.dimensions();
    let mut original = Cursor::new(Vec::new());
    let mut thumbnail = Cursor::new(Vec::new());
    image
        .write_to(&mut original, ImageFormat::WebP)
        .map_err(|_| AppError::internal())?;
    image
        .thumbnail(640, 640)
        .write_to(&mut thumbnail, ImageFormat::WebP)
        .map_err(|_| AppError::internal())?;
    Ok(Processed {
        original: original.into_inner(),
        thumbnail: thumbnail.into_inner(),
        width,
        height,
    })
}

fn decode_limits() -> Limits {
    let mut limits = Limits::default();
    limits.max_image_width = Some(12000);
    limits.max_image_height = Some(12000);
    limits.max_alloc = Some(256 * 1024 * 1024);
    limits
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_svg_and_corrupt_images() {
        assert!(process(b"<svg xmlns='http://www.w3.org/2000/svg'></svg>").is_err());
        assert!(process(b"\x89PNG\r\n\x1a\ninvalid").is_err());
    }
}
