# 程序配置（config.rs）

上一片讲了`main`函数做了什么事情。这一篇我开始讲讲`config`文件做了什么事情。老规矩先上源码。

```rust
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
/// 读取环境变量，如果不存在则返回默认值
/// env::var()函数用于读取进程的环境变量，返回类型是Result<String, VarError>
/// VarError::NotPresent表示环境变量不存在，VarError::InvalidUnicode表示环境变量不是有效的Unicode字符串
/// 如果环境变量不存在，则返回默认值，如果环境变量不是有效的Unicode字符串，则返回错误
fn value(name: &str, default: &str) -> io::Result<String> {
    // 从环境中读取
    match env::var(name) {
        Ok(v) => Ok(v),
        Err(env::VarError::NotPresent) => Ok(default.into()),
        Err(_) => Err(invalid(&format!("{name} 不是有效 Unicode"))),
    }
}
/// 读取环境变量，如果不存在则返回默认值，如果不是正整数则返回错误
fn positive(name: &str, default: &str) -> io::Result<i64> {
    let n = value(name, default)?
        .parse()
        .map_err(|_| invalid(&format!("{name} 必须是正整数")))?;
    if n <= 0 {
        return Err(invalid(&format!("{name} 必须大于 0")));
    }
    Ok(n)
}
/// 加载进程环境，部署、生产和测试都采用一套配置，按需求进行加载
/// APP_ENV: 环境变量，可选值为 development、production 或 test
/// DATABASE_URL: 数据库连接串，生产环境必须设置 DATABASE_URL_FILE 环境变量，指向数据库连接串文件
/// BIND_ADDR: 监听地址，默认 0.0.0.0:8080
/// PUBLIC_ORIGIN: 公开的同源地址，生产环境必须是 HTTPS，开发环境默认 http://localhost:5173
/// TRUSTED_PROXIES: 后端信任哪些反向代理，不是允许哪些访客访问。
/// VISITOR_HMAC_KEY_FILE: 访客 HMAC 密钥文件，生产环境必须设置。主要是用来在数据库中保存访客记录，方便统计
/// SESSION_IDLE_HOURS: 会话闲置期限，默认 12 小时。
impl Config {
    pub fn from_env() -> io::Result<Self> {
        let environment = value("APP_ENV", "development")?; // 读取应用进程环境，判断是部署、开发还是测试环境
        if !["development", "production", "test"].contains(&environment.as_str()) {
            return Err(invalid("APP_ENV 必须为 development、production 或 test"));
        }
        let production = environment == "production"; // 如果是生产环境
        let database_url = match env::var_os("DATABASE_URL_FILE") {
            Some(path) => fs::read_to_string(path)?.trim().to_owned(), // 读取数据库连接串
            None if !production => value("DATABASE_URL", "")?, // 非生产环境下，未指定连接串文件时，改用 DATABASE_URL 环境变量
            None => return Err(invalid("生产必须设置 DATABASE_URL_FILE")),
        };
        if database_url.is_empty() {
            return Err(invalid("数据库连接串未设置"));
        }
        let bind_addr = value("BIND_ADDR", "0.0.0.0:8080")? // 绑定IP和端口
            .parse()
            .map_err(|_| invalid("BIND_ADDR 格式错误"))?;

        // 设置前端能能够访问后端的来源
        let public_origin = value(
            "PUBLIC_ORIGIN",
            if production {
                ""
            } else {
                "http://localhost:5173"
            },
        )?;

        let origin = url::Url::parse(&public_origin) // 解析Url地址，必须是http/https
            .map_err(|_| invalid("PUBLIC_ORIGIN 必须是 http/https origin"))?;

        if !["http", "https"].contains(&origin.scheme())    // 如果不是http/https，或者不是本地开发环境且来源站点不被允许，则返回错误
            || origin.origin().ascii_serialization() != public_origin   // 配置必须与规范化后的来源字符串完全一致
            || (production && origin.scheme() != "https")
        {
            return Err(invalid(
                "PUBLIC_ORIGIN 必须为不含路径的规范 origin；生产要求 HTTPS",
            ));
        }
        // 获取TRUSTED_PROXIES环境变量，默认空字符串，设置反向代理的时候，将符合要求的代理路径放行
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
        // 读取进程环境变量VISITOR_HMAC_KEY_FILE，如果生产环境且未设置，则返回错误
        let visitor_key_file = env::var_os("VISITOR_HMAC_KEY_FILE").map(PathBuf::from);
        if production && visitor_key_file.is_none() {
            return Err(invalid("生产必须设置 VISITOR_HMAC_KEY_FILE"));
        }
        // 设置管理员的登陆时创建的会话市场限制，默认12小时，7天
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

    /// 设置管理员登录后如何保持身份
    pub fn session_cookie(&self) -> &'static str {
        if self.production {
            "__Host-admin_session"
        } else {
            "admin_session_dev"
        }
    }
    /// 设置访客访问后如何保持身份
    pub fn visitor_cookie(&self) -> &'static str {
        if self.production {
            "__Host-visit_id"
        } else {
            "visit_id_dev"
        }
    }
}
```

`config`文件源码看上其很长，实际上一点也不短，哈哈哈。我们先对这个源代码做个总结，辣（那）么长的代码，实际上也就做了下面一点点事情：

1. 首先创建了一个`Config`的结构体，方便存储信息
2. 代码为`Config`结构体实现了一个方法。这个方法就是用来加载`Config`中的成员变量了。其具体加载了下面几个信息
   1. 主
3. 代码设置了一些用于前端控制的相关信息。



001 · 