use backend::config::Config;
use sqlx::{migrate::Migrator, postgres::PgPoolOptions};
use std::{env, io, path::PathBuf, time::Duration};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 复用配置读取，不启动 HTTP 服务。
    let config = Config::from_env()?;

    // 创建数据库连接池
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_secs(config.database_acquire_timeout))
        .connect(&config.database_url)
        .await?;

    // 本地默认使用源码目录；部署迁移程序时可显式指定随包提供的目录。
    let migrations_dir = match env::var_os("MIGRATIONS_DIR") {
        Some(path) if !path.is_empty() => PathBuf::from(path),
        Some(_) => {
            return Err(
                io::Error::new(io::ErrorKind::InvalidInput, "MIGRATIONS_DIR 不能为空").into(),
            );
        }
        None => PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("migrations"),
    };
    // 运行时读取 SQL 文件，并执行尚未应用的迁移。
    let migrator = Migrator::new(migrations_dir.as_path()).await?;
    // 保留 SQLx 默认迁移锁、事务和 checksum 校验，不忽略缺失/失败的迁移。
    let result = migrator.run(&pool).await;

    // 无论迁移成功或失败，都先关闭连接池。
    pool.close().await;
    result?;

    println!(
        "数据库迁移完成，已校验 {} 个迁移版本",
        migrator.iter().count()
    );

    Ok(())
}
