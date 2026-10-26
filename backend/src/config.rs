use ipnet::IpNet;
use std::{env, fs, io, net::SocketAddr, path::PathBuf};

#[derive(Clone)]
pub struct Config {
    pub bind_addr: SocketAddr,             // HTTP 监听地址。
    pub database_url: String,              // 数据库秘密，不派生 Debug、不写日志。
    pub database_pool_size: u32,           // 连接池上限。
    pub database_acquire_timeout: u64,     // 获取连接的超时秒数。
    pub production: bool,                  // 决定安全 Cookie 和秘密配置要求。
    pub public_origin: String,             // 允许的精确同源地址。
    pub media_root: PathBuf,               // 私有媒体根目录。
    pub trusted_proxies: Vec<IpNet>,       // 允许提供转发地址的代理网段。
    pub session_idle_hours: i64,           // 会话闲置期限。
    pub session_max_days: i64,             // 会话绝对期限。
    pub visitor_key_file: Option<PathBuf>, // 访客 HMAC 密钥文件。
    pub visitor_key_version: i32,          // HMAC 密钥版本。
    pub geoip_file: Option<PathBuf>,       // 可选本地区域 CIDR 数据源。
}
fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, message)
}
fn value(name: &str, default: &str) -> io::Result<String> {
    match env::var(name) {
        Ok(v) => Ok(v),
        Err(env::VarError::NotPresent) => Ok(default.into()),
        Err(_) => Err(invalid(&format!("{name} 不是有效 Unicode"))),
    }
}
fn positive(name: &str, default: &str) -> io::Result<i64> {
    let n = value(name, default)?
        .parse()
        .map_err(|_| invalid(&format!("{name} 必须是正整数")))?;
    if n <= 0 {
        return Err(invalid(&format!("{name} 必须大于 0")));
    }
    Ok(n)
}
impl Config {
    pub fn from_env() -> io::Result<Self> {
        let environment = value("APP_ENV", "development")?;
        if !["development", "production", "test"].contains(&environment.as_str()) {
            return Err(invalid("APP_ENV 必须为 development、production 或 test"));
        }
        let production = environment == "production";
        let database_url = match env::var_os("DATABASE_URL_FILE") {
            Some(path) => fs::read_to_string(path)?.trim().to_owned(),
            None if !production => value("DATABASE_URL", "")?,
            None => return Err(invalid("生产必须设置 DATABASE_URL_FILE")),
        };
        if database_url.is_empty() {
            return Err(invalid("数据库连接串未设置"));
        }
        let bind_addr = value("BIND_ADDR", "0.0.0.0:8080")?
            .parse()
            .map_err(|_| invalid("BIND_ADDR 格式错误"))?;
        let public_origin = value(
            "PUBLIC_ORIGIN",
            if production {
                ""
            } else {
                "http://localhost:5173"
            },
        )?;
        let origin = url::Url::parse(&public_origin)
            .map_err(|_| invalid("PUBLIC_ORIGIN 必须是 http/https origin"))?;
        if !["http", "https"].contains(&origin.scheme())
            || origin.origin().ascii_serialization() != public_origin
            || (production && origin.scheme() != "https")
        {
            return Err(invalid(
                "PUBLIC_ORIGIN 必须为不含路径的规范 origin；生产要求 HTTPS",
            ));
        }
        let trusted_proxies = value("TRUSTED_PROXIES", "")?
            .split(',')
            .filter(|x| !x.trim().is_empty())
            .map(|x| {
                x.trim()
                    .parse()
                    .map_err(|_| invalid("TRUSTED_PROXIES 含无效 CIDR"))
            })
            .collect::<io::Result<Vec<_>>>()?;
        if value("DISPLAY_TIMEZONE", "Asia/Shanghai")? != "Asia/Shanghai" {
            return Err(invalid("首期 DISPLAY_TIMEZONE 固定为 Asia/Shanghai"));
        }
        let visitor_key_file = env::var_os("VISITOR_HMAC_KEY_FILE").map(PathBuf::from);
        if production && visitor_key_file.is_none() {
            return Err(invalid("生产必须设置 VISITOR_HMAC_KEY_FILE"));
        }
        let session_idle_hours = positive("SESSION_IDLE_HOURS", "12")?;
        let session_max_days = positive("SESSION_MAX_DAYS", "7")?;
        if session_idle_hours > 168 || session_max_days > 7 {
            return Err(invalid(
                "会话闲置期限不能超过 168 小时，绝对期限不能超过 7 天",
            ));
        }
        Ok(Self {
            bind_addr,
            database_url,
            database_pool_size: u32::try_from(positive("DATABASE_POOL_SIZE", "5")?)
                .map_err(|_| invalid("连接池上限过大"))?,
            database_acquire_timeout: positive("DATABASE_ACQUIRE_TIMEOUT", "5")? as u64,
            production,
            public_origin,
            media_root: PathBuf::from(value(
                "MEDIA_ROOT",
                if production {
                    "/data/media"
                } else {
                    "./data/media"
                },
            )?),
            trusted_proxies,
            session_idle_hours,
            session_max_days,
            visitor_key_file,
            visitor_key_version: i32::try_from(positive("VISITOR_HMAC_KEY_VERSION", "1")?)
                .map_err(|_| invalid("HMAC 版本过大"))?,
            geoip_file: env::var_os("GEOIP_FILE").map(PathBuf::from),
        })
    }
    pub fn session_cookie(&self) -> &'static str {
        if self.production {
            "__Host-admin_session"
        } else {
            "admin_session_dev"
        }
    }
    pub fn visitor_cookie(&self) -> &'static str {
        if self.production {
            "__Host-visit_id"
        } else {
            "visit_id_dev"
        }
    }
}
