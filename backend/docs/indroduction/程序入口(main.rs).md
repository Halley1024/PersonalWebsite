# 程序入口（main.rs）

Rust的Web后端程序都有一个运行入口`main`函数。在启动`main`函数时，就会加载相关的配置用来维护进程运行。这篇文章我直接来看看`PersonalWebite`的`main`函数源码，来拆解`main`函数启动时做了什么事情。同时也方便大家进一步了解基于`Rust`开发的Web项目。

```rust
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
```

先从整体上面来看，`main`函数主要是做了下面几件事情：

1. 创建一个日志输出器。用来打印和记录服务器请求和服务器操作
2. 加载相关的配置信息。主要让程序通过加载环境变量获得相关的数据库连接、端口绑定以及`session`设置相关信息
3. 注册程序运行时路有状态。
4. 建立TCP连接，并执行监听和数据库连接服务

接下来我们就来详细了解`main`函数中每个操作和每个函数所做的事情。

## 001 · 导入的依赖包

## 002 · 日志输出器

## 003 · 加载配置文件

## 004 · 注册路有状态

## 005 · 建立TCP连接

## 006 · 关闭