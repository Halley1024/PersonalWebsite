use backend::{app, config::Config, state::AppState};
use tokio::net::TcpListener;
use tracing_subscriber::EnvFilter;
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt() // 创建一个日志输出器
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or(EnvFilter::try_new(
                std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".into()),
            )?),
        )
        .json()
        .init();

    let config = Config::from_env()?; // 加载进程配置文件，其中分了deployment、production和test三种环境

    let state = AppState::new(&config).await?; // 注册后端进程的状态
    let listener = TcpListener::bind(config.bind_addr).await?;
    tracing::info!(address=%listener.local_addr()?,"HTTP 服务已启动");
    let application = app::build_app(state.clone());
    let server = axum::serve(
        listener,
        application.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown());
    server.await?;
    state.db.close().await;
    Ok(())
}

async fn shutdown() {
    #[cfg(unix)]
    {
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                .expect("注册 SIGTERM");
        tokio::select! {_ = tokio::signal::ctrl_c()=>{},_ = terminate.recv()=>{}}
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}
