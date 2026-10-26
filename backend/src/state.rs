use crate::{
    common::clock::{Clock, SystemClock},
    config::Config,
    modules::access::geoip::GeoLookup,
};
use rand::RngCore;
use sqlx::{PgPool, postgres::PgPoolOptions};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::sync::Semaphore;
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,                                          // 所有请求共享的连接池。
    pub config: Arc<Config>,                                 // 已校验配置；不记录秘密。
    pub clock: Arc<dyn Clock>,                               // 可替换的时钟，便于边界测试。
    pub crypto: Arc<Semaphore>,                              // 限制密码散列并发和内存占用。
    pub image_jobs: Arc<Semaphore>,                          // 限制图片解码并发。
    pub limits: Arc<Mutex<HashMap<String, (Instant, u32)>>>, // 单实例有界限流窗口。
    pub dummy_password_hash: Arc<String>,                    // 用于不存在账号的等成本密码验证。
    pub visitor_key: Arc<Vec<u8>>,                           // HMAC 密钥，不输出到响应或日志。
    pub geo: Arc<GeoLookup>,                                 // 本地归属地快照。
}
impl AppState {
    pub async fn new(config: &Config) -> Result<Self, Box<dyn std::error::Error>> {
        let db = PgPoolOptions::new()
            .max_connections(config.database_pool_size)
            .after_connect(|connection, _| {
                Box::pin(async move {
                    sqlx::query("SET TIME ZONE 'UTC'")
                        .execute(connection)
                        .await?;
                    Ok(())
                })
            })
            .acquire_timeout(Duration::from_secs(config.database_acquire_timeout))
            .connect(&config.database_url)
            .await?;
        sqlx::query("SELECT 1").execute(&db).await?;
        tokio::fs::create_dir_all(config.media_root.join(".tmp")).await?;
        // 写入探针验证媒体目录可读写，不依赖仅检查目录是否存在。
        let probe = config
            .media_root
            .join(".tmp")
            .join(uuid::Uuid::new_v4().to_string());
        tokio::fs::write(&probe, b"probe").await?;
        tokio::fs::read(&probe).await?;
        tokio::fs::remove_file(&probe).await?;
        let key_path = config
            .visitor_key_file
            .clone()
            .unwrap_or_else(|| config.media_root.join(".visitor-hmac-key"));
        if !config.production && !key_path.exists() {
            use std::io::Write;
            let mut bytes = vec![0; 32];
            rand::rngs::OsRng.fill_bytes(&mut bytes);
            let mut options = std::fs::OpenOptions::new();
            options.write(true).create_new(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                options.mode(0o600);
            }
            match options.open(&key_path) {
                Ok(mut f) => f.write_all(&bytes)?,
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
                Err(e) => return Err(e.into()),
            }
        }
        let key = tokio::fs::read(&key_path).await?;
        if key.len() < 32 {
            return Err("HMAC 密钥文件至少需要 32 字节".into());
        }
        let dummy_password_hash = Arc::new(
            tokio::task::spawn_blocking(crate::modules::auth::service::dummy_hash)
                .await?
                .map_err(std::io::Error::other)?,
        );
        let geo = GeoLookup::load(config.geoip_file.as_deref(), &db).await?;
        Ok(Self {
            db,
            config: Arc::new(config.clone()),
            clock: Arc::new(SystemClock),
            crypto: Arc::new(Semaphore::new(2)),
            image_jobs: Arc::new(Semaphore::new(2)),
            limits: Arc::new(Mutex::new(HashMap::new())),
            dummy_password_hash,
            visitor_key: Arc::new(key),
            geo: Arc::new(geo),
        })
    }
}
