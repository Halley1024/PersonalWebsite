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

    let listener = TcpListener::bind(config.bind_addr).await?; // 建立TCP监听器，绑定监听地址
    tracing::info!(address=%listener.local_addr()?,"HTTP 服务已启动");
    let application = app::build_app(state.clone());
    // 仔细阅读axmu::server源码就知道，这段代码实际上将listener监听到的路有应用转为application上的对应的handler服务
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
    #[cfg(unix)] // 如果是Unix系统
    {
        // 中断信号量
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                .expect("注册 SIGTERM");
        tokio::select! {_ = tokio::signal::ctrl_c()=>{},_ = terminate.recv()=>{}} // 使用select做线程竞速。看看时接受Ctrl+C中断线程还是操作系统发送中断信号量，其中一个发生即可
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}
