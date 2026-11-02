# 程序入口（main.rs）

Rust 二进制程序通常从 `main` 函数开始运行。这篇文章以 `PersonalWebsite` 当前的 [main.rs](../../src/main.rs) 为入口，逐段拆解服务如何初始化、接收 HTTP 请求以及关闭，帮助我们理解基于 Rust、Tokio 和 Axum 开发的 Web 后端。

本文保留原有 001–006 章节，按照“这行代码做什么 → 谁在调用 → 如何使用、返回什么 → 示例 → 同类操作有什么不同”的顺序讲解。项目自定义函数以当前源码为准；第三方 API 对照本地依赖源码，版本包括 Axum 0.8.9、Tokio 1.54.1、tracing-subscriber 0.3.23、SQLx 0.8.6。示例用于说明用法，未单独编译，也不代表数据库和 HTTP 服务已经实测通过。

> 实际目录名为 `docs/indroduction`，本文沿用现有路径。下面保留当前入口源码，包括原注释；其中“加载配置文件”“注册状态”“线程竞速”等表述的准确含义，会在对应章节说明。

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
```

先从整体上看，入口按下面的顺序运行：

```text
Tokio 运行时执行 main
  → 初始化全局日志订阅器
  → 读取并校验配置
  → 建立数据库连接池、检查媒体目录、加载共享资源
  → 绑定 TCP 监听地址
  → 构建路由并注入共享状态
  → 等待并处理 HTTP 请求，同时等待关闭信号
  → 停止接收新连接，等待现有连接结束
  → 关闭数据库连接池
  → 返回 Ok(())，进程正常退出
```

源码中的 `?` 会在错误发生时提前返回，因此上述顺序描述的是正常路径。后面的清理语句并不是所有退出路径都会执行，具体见第 006 节。

## 001 · 导入的依赖包

### 1.1 · `use` 导入了什么

```rust
use backend::{app, config::Config, state::AppState};
use tokio::net::TcpListener;
use tracing_subscriber::EnvFilter;
```

这里没有函数调用，`use` 是路径导入语法，既不创建对象，也不执行初始化，更没有返回值。

| 名称 | 主体和定义位置 | 在入口中的作用 |
| --- | --- | --- |
| `backend` | 当前 Cargo 包的库 crate，入口为 [lib.rs](../../src/lib.rs) | 给同包的二进制提供公共模块 |
| `app` | `backend::app` 模块 | 提供 `build_app`，组装 Axum 应用 |
| `Config` | [config.rs](../../src/config.rs) 中的结构体 | 保存已校验的配置 |
| `AppState` | [state.rs](../../src/state.rs) 中的结构体 | 保存请求处理期间共享的资源 |
| `TcpListener` | Tokio 的异步 TCP 监听器类型 | 绑定监听地址并接收连接 |
| `EnvFilter` | tracing-subscriber 的日志过滤器类型 | 解析日志级别和目标模块过滤规则 |

同一个包可以同时存在库和多个二进制。`Cargo.toml` 中包名是 `backend`，`src/lib.rs` 声明了 `pub mod app`、`pub mod config`、`pub mod state`，所以 `src/main.rs` 能通过库 crate 名 `backend::...` 使用这些模块。

`main.rs` 里的 `crate::` 指向这个二进制自身的根；在 `lib.rs` 及其子模块中，`crate::` 则指向库的根。不能机械地把这里的 `backend::app` 替换为 `crate::app`。

常见导入方式：

```rust
use backend::config::Config;           // 导入类型
use backend::config::Config as AppConfig; // 为当前作用域起别名
use backend::app::build_app;           // 直接导入函数，之后写 build_app(...)
// use backend::config::*;             // 通配导入公开名称，容易让来源不明确
```

还要区分四种看起来相近的表达式：

| 写法 | 类型 | 调用主体、接收者 |
| --- | --- | --- |
| `app::build_app(state)` | 模块中的自由函数 | `app` 模块；`state` 是参数 |
| `Config::from_env()` | 类型上的关联函数 | `Config` 类型，没有 `self` 接收者 |
| `listener.local_addr()` | 实例方法 | `listener` 对象，以 `&self` 借用 |
| `tracing::info!(...)` | 宏调用 | `tracing` 提供的宏，不能按普通函数签名理解 |

### 1.2 · `#[tokio::main]` 和 `async fn main`

```rust
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // ...
}
```

`#[tokio::main]` 是 Tokio 提供的属性宏。操作系统启动程序时需要普通入口；宏负责创建 Tokio 运行时，再让运行时执行异步函数体。它不是一个返回运行时对象的普通函数调用。

当前没有指定 `flavor`，且依赖启用了 `rt-multi-thread`，因此采用默认多线程运行时。入口 future 由 `block_on` 驱动，不能把“多线程运行时”理解为每一行代码都会自动分到不同线程。

下面是便于理解的概念等价写法，不是宏的逐字展开：

```rust
fn main() -> Result<(), Box<dyn std::error::Error>> {
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?
        .block_on(async {
            // 原 async main 的函数体
            Ok(())
        })
}
```

| 操作 | 主体 | 返回值或效果 |
| --- | --- | --- |
| `Builder::new_multi_thread()` | Tokio 运行时构建器 | `Builder` |
| `.enable_all()` | 构建器对象 | `&mut Builder`，启用可用的 I/O 和时间驱动 |
| `.build()` | 构建器对象 | `std::io::Result<Runtime>` |
| `.block_on(future)` | 运行时对象 | 等待完成，返回 future 的输出 |

常见替代写法是 `#[tokio::main(flavor = "current_thread")]`：使用单线程调度器，同样支持多个异步任务并发等待 I/O；它与多线程运行时的区别主要是任务调度方式，不是“能否使用异步”。在已有运行时内部不要再嵌套调用这个入口来创建、阻塞另一个运行时。

### 1.3 · 返回类型、`.await` 和 `?`

`Result<(), Box<dyn std::error::Error>>` 表示：成功时返回单位值 `()`，失败时返回装箱的错误 trait 对象。`dyn Error` 用于承载不同具体类型的错误，`Box` 持有它；它不是固定的某一种数据库错误。

```rust
let state = AppState::new(&config).await?;
```

这行分成三步理解：

1. `AppState::new(&config)` 创建异步计算，得到实现 `Future` 的值。
2. `.await` 等待该计算完成，得到 `Result<AppState, Box<dyn Error>>`；等待期间当前任务可以让出执行权。
3. `?` 从 `Ok(state)` 中取出状态；若为 `Err(e)`，立即从当前函数返回错误，必要时进行错误类型转换。

对于 `Config::from_env()?`，没有 `.await`，因为它是同步函数，直接返回 `io::Result<Config>`。

在这里，`?` 的错误传播可以用下面的示意代码帮助理解：

```rust
let config = match Config::from_env() {
    Ok(config) => config,
    Err(error) => return Err(error.into()),
};
```

| 操作 | 成功时 | 失败时 | 适合场景 |
| --- | --- | --- | --- |
| `result?` | 取出成功值 | 向调用方传播错误 | 让启动失败原因传递到入口 |
| `result.unwrap()` | 取出成功值 | panic | 已有充分保证的短示例等 |
| `result.expect("说明")` | 取出成功值 | 带自定义说明 panic | 认为失败不可恢复且希望明确报错的位置 |
| `result.unwrap_or(default)` | 取出成功值 | 使用默认值 | 默认值计算简单；它会提前计算 |
| `result.unwrap_or_else(\|err\| fallback(err))` | 取出成功值 | 调用闭包计算默认值 | 仅在失败时执行备用逻辑 |
| `match result { ... }` | 自己处理 | 自己处理 | 按错误类型分支、记录日志或重试 |

`Ok(())` 是构造成功结果；函数末尾没有分号，意味着将它作为返回值。`Result` 返回错误和 `panic` 是不同的退出方式，不能把所有失败都理解为 `?` 返回。

## 002 · 日志输出器

### 2.1 · 日志初始化链中的调用主体和返回值

```rust
tracing_subscriber::fmt()
    .with_env_filter(/* EnvFilter */)
    .json()
    .init();
```

这里更准确的名称是“配置并安装全局日志订阅器”。`tracing` 产生事件和 span，`tracing-subscriber` 负责过滤、格式化和输出。

| 调用 | 主体或接收者 | 做了什么 | 返回值 |
| --- | --- | --- | --- |
| `tracing_subscriber::fmt()` | crate 中的自由函数 | 创建格式化订阅器的构建器 | `SubscriberBuilder` |
| `.with_env_filter(filter)` | 上一步的构建器，按值接收 | 配置过滤规则 | 带新过滤器类型参数的构建器 |
| `.json()` | 构建器，按值接收 | 将日志事件格式改为 JSON | 带 JSON 格式类型参数的构建器 |
| `.init()` | 最终构建器，按值接收 | 安装为全局默认订阅器 | `()`；安装失败可能 panic |

链式调用不是反复修改同一个可变对象的唯一实现方式：这些方法会消费构建器并返回新构建器，Rust 的类型参数可以随着配置变化。

当前默认向标准输出写日志，没有配置日志文件、文件轮转或集中存储。初始化订阅器也不会自动为每一个 HTTP 请求生成访问日志；实际有哪些事件，要看处理器、中间件等位置调用了哪些日志宏。

### 2.2 · 环境过滤规则如何产生

```rust
EnvFilter::try_from_default_env().unwrap_or(EnvFilter::try_new(
    std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".into()),
)?)
```

| 调用 | 主体 | 参数、用法 | 返回值 |
| --- | --- | --- | --- |
| `EnvFilter::try_from_default_env()` | `EnvFilter` 类型 | 默认读取 `RUST_LOG` | `Result<EnvFilter, FromEnvError>` |
| `std::env::var("LOG_LEVEL")` | 标准库环境模块 | 读取进程环境变量，要求值可表示为 Unicode | `Result<String, VarError>` |
| `.unwrap_or_else(\|_\| "info".into())` | 上一步的 `Result` | 读取失败时用默认字符串，`_` 表示不使用错误值 | `String` |
| `"info".into()` | 字符串切片，通过 `Into` trait 转换 | 由上下文推断转换为 `String` | `String` |
| `EnvFilter::try_new(text)` | `EnvFilter` 类型 | 解析过滤指令字符串 | `Result<EnvFilter, ParseError>` |
| 内部 `?` | 运算符 | 过滤指令解析失败时直接从 `main` 返回错误 | 成功时得到 `EnvFilter` |
| 外层 `.unwrap_or(filter)` | 第一个 `Result` | `RUST_LOG` 读取或解析失败时选择备用过滤器 | `EnvFilter` |

需要注意，`LOG_LEVEL` 是本项目主动读取的变量名，不是 `EnvFilter::try_from_default_env()` 自动读取的名字。对 `LOG_LEVEL` 的读取失败包括“变量不存在”和“非 Unicode”，本段代码都会退回 `info`。

### 2.3 · `unwrap_or` 的提前计算影响

当前代码在选择过滤器之前，总会先计算 `.unwrap_or(...)` 的参数，包括解析 `LOG_LEVEL`。因此不能简单概括为“有 `RUST_LOG` 就完全忽略 `LOG_LEVEL`”。

| 环境情况 | 当前行为 |
| --- | --- |
| `RUST_LOG` 有效，`LOG_LEVEL` 未设置 | 先构造 `info` 备用过滤器，最终使用 `RUST_LOG` |
| `RUST_LOG` 未设置或非法，`LOG_LEVEL=debug` | 使用 `debug` |
| 两个变量都未设置 | 使用 `info` |
| `RUST_LOG=info` 有效，但 `LOG_LEVEL=[` 非法 | 备用解析先报错，`?` 使启动失败 |

可以用下面这个不依赖服务的例子理解“提前计算”：

```rust
fn fallback() -> i32 {
    println!("计算默认值");
    10
}
let value: Result<i32, &str> = Ok(1);
let a = value.unwrap_or(fallback());       // 仍打印“计算默认值”，a = 1
let b = value.unwrap_or_else(|_| fallback()); // 不打印，b = 1
```

如果希望只有 `RUST_LOG` 失败时才解析备用配置，可采用下面的替代写法。**这是用法对比，当前 `main.rs` 未改动。**

```rust
let filter = match EnvFilter::try_from_default_env() {
    Ok(filter) => filter,
    Err(_) => {
        let level = std::env::var("LOG_LEVEL")
            .unwrap_or_else(|_| "info".into());
        EnvFilter::try_new(level)?
    }
};
tracing_subscriber::fmt().with_env_filter(filter).json().init();
```

这里用 `match`，是为了让备用分支中的 `?` 清楚地向 `main` 传播错误。不能直接把原代码的 `unwrap_or` 改成 `unwrap_or_else` 并照搬闭包内的 `?`：该闭包预期返回 `EnvFilter`，并非 `Result`。

### 2.4 · 日志使用示例和同类操作

在 `backend` 目录中，启动命令可以这样指定过滤规则：

```bash
RUST_LOG=info,backend=debug cargo run --bin backend
```

该命令仍要求数据库、配置、表结构和媒体目录等条件齐备；这里仅说明变量传入方式，不是完整部署步骤。

`info,backend=debug` 表示默认记录 `info` 及更高严重级别事件，对 `backend` 目标允许 `debug`。`LOG_LEVEL` 虽然叫“级别”，传给 `try_new` 后同样可以使用过滤指令。

```rust
tracing::debug!(count = 3, "读取列表");
tracing::info!("服务准备完成");
tracing::warn!("外部依赖响应较慢");
tracing::error!(error = %error, "请求处理失败"); // 假设当前作用域已有 error
```

常用级别从高严重度到低严重度为 `error → warn → info → debug → trace`。事件宏表达式返回 `()`，不承担业务错误传播。

| 同类操作 | 用法和区别 |
| --- | --- |
| `.compact()` / `.pretty()` | 更换为紧凑文本或便于人工阅读的格式；`.json()` 便于日志平台解析 |
| `.with_max_level(tracing::Level::INFO)` | 配置固定级别；`EnvFilter` 能表达按目标模块区分的动态规则 |
| `.try_init()` | 安装失败返回 `Result<(), Box<dyn Error + Send + Sync>>`；`.init()` 失败会 panic |
| `EnvFilter::new(text)` | 对非法指令采取宽容解析；`try_new(text)` 返回解析错误，适合启动时校验 |
| `println!(...)` | 直接输出文本，不经过这里配置的 tracing 过滤和 JSON 格式化 |

`.try_init()` 的错误类型多了 `Send + Sync` 约束。替换时应同时检查外层函数的错误类型转换，不要假设所有 `Box<dyn Error ...>` 都可以不经处理直接用 `?` 互换。

## 003 · 加载配置文件

### 3.1 · 当前代码实际加载的是进程配置

```rust
let config = Config::from_env()?;
```

调用主体是项目自定义的 `Config` 类型，定义在 [config.rs](../../src/config.rs)。这是不接收 `self` 的同步关联函数：

```rust
pub fn from_env() -> std::io::Result<Self>
```

这里 `Self` 就是 `Config`。成功返回 `Ok(Config { ... })`，失败返回 `io::Error`；`?` 将错误传回 `main`。绑定完成后，局部变量 `config` 的类型是 `Config`，不再是 `Result`。

当前实现主要读取环境变量，并按部分变量指定的路径读取秘密文件；没有在这个函数里自动加载 `.env`、TOML 或 YAML。即使项目目录存在 `.env`，也需要外部启动工具导出变量或额外的加载逻辑。

原注释中的 `deployment` 应理解为笔误：实际允许的 `APP_ENV` 是 `development`、`production`、`test`。三者经过同一套解析流程，`production` 会启用额外要求；`test` 不会自动切换到测试数据库。

### 3.2 · 与入口有关的配置和失败场景

| 配置 | 当前规则 | 后续由谁使用 |
| --- | --- | --- |
| `APP_ENV` | 默认 `development`，只允许上述三种值 | 决定生产环境校验和 Cookie 等行为 |
| `DATABASE_URL_FILE` | 设置时优先读取文件、去除首尾空白；生产必须设置 | `AppState::new` 建立连接池 |
| `DATABASE_URL` | 非生产且未指定连接串文件时使用；最终不能为空 | 数据库连接 |
| `BIND_ADDR` | 默认 `0.0.0.0:8080`，解析为 `SocketAddr` | `TcpListener::bind` |
| `PUBLIC_ORIGIN` | 开发默认 `http://localhost:5173`；要求规范 origin，生产要求 HTTPS | 同源检查等应用逻辑 |
| `MEDIA_ROOT` | 非生产默认 `./data/media`，生产默认 `/data/media` | 媒体目录探针及文件存储 |
| `DATABASE_POOL_SIZE` | 默认 `5`，要求正整数并可表示为 `u32` | 连接池最大连接数 |
| `DATABASE_ACQUIRE_TIMEOUT` | 默认 `5` 秒，要求正整数 | 获取数据库连接超时 |
| `VISITOR_HMAC_KEY_FILE` | 生产必须设置；非生产可使用媒体目录下的默认文件 | 访客标识 HMAC 密钥 |

例如，`BIND_ADDR=localhost:8080` 在这里会解析失败，因为配置字段要求数值 IP 形式的 `SocketAddr`；应使用 `127.0.0.1:8080` 或 `[::1]:8080`。虽然 Tokio 的 `bind` 本身支持更多地址输入，项目配置层已经收窄了输入类型。

“配置合法”和“资源可用”是两步：`Config::from_env()` 可以成功读取数据库连接串，但数据库是否能连接，要到 `AppState::new(&config).await` 才能知道。

### 3.3 · 使用示例和同类操作

假设当前目录是 `backend`，并已有可用且完成迁移的本地 PostgreSQL：

```bash
APP_ENV=development \
DATABASE_URL='postgres://demo:demo@127.0.0.1:5432/personal_website' \
BIND_ADDR='127.0.0.1:8080' \
PUBLIC_ORIGIN='http://localhost:5173' \
cargo run --bin backend
```

其中数据库账号和库名只是示例，不是项目提供的真实凭据。非生产默认媒体目录是相对于**进程工作目录**解析的，并非自动相对于 `main.rs`。

| 同类操作 | 主体和返回值 | 与当前做法的区别 |
| --- | --- | --- |
| `std::env::var(name)` | 标准库函数，`Result<String, VarError>` | 要求 Unicode，适合普通文本配置 |
| `std::env::var_os(name)` | 标准库函数，`Option<OsString>` | 保留操作系统字符串，适合文件路径；不直接区分 Unicode 错误 |
| `std::fs::read_to_string(path)` | 标准库同步函数，`io::Result<String>` | 读取文件内容并要求 UTF-8，启动线程会同步等待 |
| `tokio::fs::read_to_string(path).await` | Tokio 异步函数，等待后为 `io::Result<String>` | 接入异步调度，调用方需要异步上下文 |
| `Config::from_env()` | 项目关联函数，`io::Result<Config>` | 在基础读取之上完成默认值、类型转换和项目规则校验 |

仅调用 `env::var` 只能得到字符串，不会自动完成 `SocketAddr` 解析、生产环境校验或会话期限检查。这些都是 `Config::from_env()` 封装的项目逻辑。

## 004 · 注册路由状态

### 4.1 · `AppState::new(&config).await?` 创建了什么

```rust
let state = AppState::new(&config).await?;
```

这一行**创建并初始化共享状态**，真正把状态注入路由的是后面 `app::build_app` 内部的 `.with_state(state)`。

主体是项目的 `AppState` 类型，签名为：

```rust
pub async fn new(config: &Config)
    -> Result<Self, Box<dyn std::error::Error>>
```

`&config` 是不可变借用，函数不会拿走局部变量 `config` 的所有权。调用返回 future，等待后得到 `Result<AppState, ...>`，`?` 后局部变量 `state` 的类型是 `AppState`。

根据当前 [state.rs](../../src/state.rs)，初始化包含真实副作用：

1. 配置 PostgreSQL 连接池上限和获取连接超时；每条新连接设置 UTC 时区。
2. 连接数据库，并执行 `SELECT 1` 检查连接。
3. 创建媒体目录下的 `.tmp`，写入、读回并删除探针文件，检查目录可读写。
4. 读取访客 HMAC 密钥；非生产且文件不存在时尝试创建随机 32 字节密钥，生产不自动创建。读入后要求至少 32 字节。
5. 通过 `spawn_blocking` 计算用于账号不存在场景的密码哈希，避免直接占用异步任务执行该计算。
6. 加载区域数据；[GeoLookup::load](../../src/modules/access/geoip.rs) 会更新 `region_catalog`，因此数据库必须已具备相关表结构，即使未配置区域数据文件也会访问该表。
7. 组装共享配置、时钟、密码计算和图片处理信号量、限流窗口、密钥及区域查询对象。

所以这一行失败的原因可能是数据库不可达、表不存在、媒体目录无权限或密钥不符合要求。它没有在内部自动执行数据库迁移。

### 4.2 · 为什么状态需要 `clone`

```rust
let application = app::build_app(state.clone());
```

先看参数：`state.clone()` 调用的是 `Clone` trait 的方法，接收者是 `state`，返回另一个 `AppState` 值。

`AppState` 使用 `#[derive(Clone)]`。字段中的 `Arc<T>` 克隆后共享同一份底层数据，`PgPool` 克隆后共享同一个连接池。因此这里不会重新连接一套数据库，也不会重新执行 `AppState::new` 的初始化。

```text
main 保留的 state ──┬── 共享数据库连接池
                   ├── Arc<Config>
路由持有的 state ──┴── 其他 Arc 包装的共享资源
```

`build_app` 按值接收 `AppState`。若直接传 `state`，所有权就会移入函数，`main` 后面不能再访问 `state.db`。传 `state.clone()` 后，应用获得克隆值，入口保留自己的句柄，用于服务结束后关闭共享连接池。

注意，`clone` 的成本取决于具体类型：`String::clone()` 会复制文本缓冲区，`Vec<T>::clone()` 会克隆元素，不能因为本项目的状态克隆较轻，就把所有 `clone` 都理解为“只复制指针”。

### 4.3 · `app::build_app` 如何把状态交给请求处理

主体是项目 `app` 模块中的自由函数，定义在 [app.rs](../../src/app.rs)：

```rust
pub fn build_app(state: AppState) -> axum::Router {
    routes::build_router()
        .layer(axum::extract::DefaultBodyLimit::max(1024 * 1024))
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            crate::middleware::request_id::handle,
        ))
        .with_state(state)
}
```

它是同步函数，返回 `Router`，不返回 `Result`；因此入口不需要 `.await` 或 `?`。它负责组装业务路由、设置默认请求体提取限制、添加请求 ID 中间件，并提供共享状态。构建路由不等于已经开始监听 HTTP。

Axum 的 `Router<S>` 中，`S` 表示路由**尚缺少**的状态类型。提供 `AppState` 后，这个函数返回的 `Router` 即 `Router<()>`，表示可以用于服务，不是“应用里完全没有状态”。

下面是状态提取的独立用法片段，未新增到项目路由：

```rust
use axum::{extract::State, routing::get, Router};
use backend::state::AppState;

async fn mode(State(state): State<AppState>) -> &'static str {
    if state.config.production { "production" } else { "non-production" }
}

fn example_router(state: AppState) -> Router {
    Router::new().route("/example/mode", get(mode)).with_state(state)
}
```

`State(state)` 是提取器模式，Axum 从路由状态中为处理器取得 `AppState`。处理器声明了什么参数，就由对应提取器解释如何获得它，不是手动给每个请求传一个数据库连接池。

### 4.4 · 同类共享方式的区别

| 操作 | 返回值或效果 | 用法上的区别 |
| --- | --- | --- |
| `&state` | `&AppState` | 借用原对象，有生命周期约束；不能替代要求拥有 `AppState` 的参数 |
| `state.clone()` | `AppState` | 拥有独立的状态外层值，本项目内部资源仍共享 |
| `Arc::clone(&value)` | `Arc<T>` | 明确表达增加共享所有权，与 `Arc<T>::clone()` 相同 |
| `Arc<Mutex<T>>` | 共享且可受控修改的数据 | 比 `Arc<T>` 多了锁；项目限流窗口使用这种方式 |
| `State<T>` | 从路由状态提取 `T` | 适合应用明确声明的全局依赖 |
| `Extension<T>` | 从请求扩展提取 `T` | 适合由其他层注入的请求数据；缺失通常在运行时暴露 |

`Arc` 解决共享所有权，不会自动让内部数据可以随意修改。对于 `std::sync::Mutex`，避免持锁跨越 `.await`；否则可能阻塞执行线程，或使 future 无法满足 `Send` 等要求。

## 005 · 建立 TCP 连接

### 5.1 · `bind` 是绑定监听地址

```rust
let listener = TcpListener::bind(config.bind_addr).await?;
```

这里准确地说是“创建 TCP 监听器”，不是主动连接某个客户端。主体是 Tokio 的 `TcpListener` 类型：

```rust
pub async fn bind<A: tokio::net::ToSocketAddrs>(addr: A)
    -> std::io::Result<TcpListener>
```

参数在本项目中是 `SocketAddr`。调用得到 future，`.await` 后得到 `io::Result<TcpListener>`，`?` 后取得监听器。地址不可绑定、端口被占用等会返回错误，使入口提前结束。

| 地址示例 | 含义 |
| --- | --- |
| `127.0.0.1:8080` | 仅绑定本机 IPv4 回环地址 |
| `0.0.0.0:8080` | 绑定所有本机 IPv4 接口；实际能否外部访问仍取决于网络和防火墙 |
| `[::1]:8080` | 仅绑定 IPv6 回环地址 |
| `127.0.0.1:0` | 让操作系统选择可用端口，适合测试或临时服务 |

### 5.2 · `local_addr` 和结构化日志

```rust
tracing::info!(address = %listener.local_addr()?, "HTTP 服务已启动");
```

这行包含两个操作：

- `listener.local_addr()`：接收者是监听器对象，以 `&self` 借用，同步返回 `io::Result<SocketAddr>`。`?` 取得实际绑定地址。
- `tracing::info!`：宏，记录一条 `info` 事件，`address` 是结构化字段，`%` 表示使用 `Display` 格式化字段值，宏表达式返回 `()`。

`%` 是 tracing 宏的字段语法，不是取模运算。对应的 `?` 字段前缀表示 `Debug` 格式化，和表达式末尾传播错误的 `?` 是不同语法：

```rust
tracing::info!(address = %addr, "Display 格式");
tracing::debug!(address = ?addr, "Debug 格式"); // 假设 addr 已存在
```

使用端口 `0` 时，`local_addr()` 尤其有用：配置只表达“自动选择”，它返回真正分配的端口。

```rust
let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
let actual: std::net::SocketAddr = listener.local_addr()?;
tracing::info!(address = %actual, "临时监听地址");
```

当前“HTTP 服务已启动”日志是在构建路由和 `server.await` 之前输出的。它可以证明代码已经完成监听绑定，但单凭这条日志不能证明 HTTP 路由已处理请求，也不能替代端到端健康检查。

### 5.3 · 路由如何转为带连接信息的服务

```rust
let application = app::build_app(state.clone());
let server = axum::serve(
    listener,
    application.into_make_service_with_connect_info::<std::net::SocketAddr>(),
)
.with_graceful_shutdown(shutdown());
```

| 调用 | 主体或接收者 | 参数与作用 | 返回值 |
| --- | --- | --- | --- |
| `app::build_app(...)` | 项目 `app` 模块 | 使用共享状态创建应用 | `axum::Router` |
| `.into_make_service_with_connect_info::<SocketAddr>()` | `application` 路由，按值接收 | 将路由转为为连接提供服务的对象，并保留对端地址 | `IntoMakeServiceWithConnectInfo<Router, SocketAddr>` |
| `axum::serve(listener, make_service)` | Axum 自由函数 | 将监听器和 HTTP 服务组装起来 | `Serve<L, M, S>`，泛型由编译器推断 |
| `shutdown()` | 当前二进制中的异步函数 | 创建等待关闭信号的异步计算 | 实现 `Future<Output = ()>` 的值 |
| `.with_graceful_shutdown(future)` | `Serve` 对象，按值接收 | 配置关闭条件 | `WithGracefulShutdown<L, M, S, F>` |
| `server.await` | 上述可等待对象 | 驱动 HTTP 服务并等待关闭结束 | `std::io::Result<()>` |

`::<SocketAddr>` 被称为 turbofish 语法，用于显式提供泛型参数。`into_...` 通常表示消费当前值并转换：这里调用后不能再使用原变量 `application`。

`Serve` 和 `WithGracefulShutdown` 在此版本通过 `IntoFuture` 支持 `.await`，不必将它们误认为已经启动的后台线程或 `JoinHandle`。

连接处理流程可以这样理解：

```text
TcpListener 接收连接
  → 根据连接建立服务，并记录对端 SocketAddr
  → HTTP 协议层解析请求
  → Router 匹配路径和 HTTP 方法
  → 执行中间件、提取器及 handler
  → 发送 HTTP 响应
```

TCP 监听器本身不知道 `/api/v1/...` 对应哪个处理器；路由匹配由 Axum 应用完成。

### 5.4 · 为什么本项目保留对端地址

Axum 可以将连接对端放进请求扩展中，类型为 `ConnectInfo<SocketAddr>`。本项目的 [client_ip.rs](../../src/middleware/client_ip.rs) 正是从这里读取对端地址，再结合 `TRUSTED_PROXIES` 判断是否接受 `X-Forwarded-For`。

连接对端可能是反向代理，所以 `ConnectInfo` 中的 IP 不一定是浏览器的真实 IP。当前生产逻辑缺少连接信息时会返回服务不可用，不能随意去掉这个适配步骤。

用法示例：

```rust
use axum::extract::ConnectInfo;
use std::net::SocketAddr;

async fn peer(ConnectInfo(addr): ConnectInfo<SocketAddr>) -> String {
    format!("连接对端：{addr}")
}
```

该处理器只有在服务为请求提供相应连接信息时才能成功提取。

### 5.5 · 同类网络操作和服务适配的区别

| 操作 | 等待后结果或直接返回值 | 与当前操作的区别 |
| --- | --- | --- |
| `tokio::net::TcpStream::connect(addr).await` | `io::Result<TcpStream>` | 客户端主动建立连接；`bind` 是服务端监听 |
| `listener.accept().await` | `io::Result<(TcpStream, SocketAddr)>` | 手动接收一条 TCP 连接；HTTP 应用通常交给 Axum 管理 |
| `std::net::TcpListener::accept()` | `io::Result<(std::net::TcpStream, SocketAddr)>` | 默认阻塞当前线程；Tokio 的等待配合异步调度 |
| `axum::serve(listener, application)` | `Serve<...>` | 可直接服务 Router，但此写法未配置这里的 `ConnectInfo<SocketAddr>` |
| `application.into_make_service()` | `IntoMakeService<Router>` | 转为服务工厂，不提供上述连接地址扩展 |
| `application.into_make_service_with_connect_info::<SocketAddr>()` | 带连接信息的服务工厂 | 本项目 IP 识别需要这一信息 |

不要把 `server.await?` 理解为“等待一条请求完成”。它通常会持续到整个服务关闭；正常接收和处理请求期间不会继续执行下一行 `state.db.close().await`。

## 006 · 关闭

### 6.1 · `shutdown()` 何时执行

```rust
.with_graceful_shutdown(shutdown());
server.await?;
```

调用异步函数 `shutdown()` 先创建 future；函数体在 future 被轮询时才开始执行。Axum 驱动服务时也会等待它，当它完成并输出 `()`，就把这当作关闭条件。

注意，关闭条件是“future 完成”，不是“必须成功收到某个特定信号”。当前代码忽略了部分信号等待错误，因此错误也可能让关闭 future 完成。

### 6.2 · 条件编译决定使用哪段代码

```rust
#[cfg(unix)]
{ /* Unix 信号处理 */ }
#[cfg(not(unix))]
{ /* 非 Unix 的 Ctrl+C 处理 */ }
```

`#[cfg(...)]` 是编译期属性，判断的是编译目标。Ubuntu 等 Unix 目标编译第一段；非 Unix 目标编译第二段。这不是运行时 `if`，不符合条件的代码不会进入该目标的编译结果。

常见相关写法：

| 写法 | 用途及区别 |
| --- | --- |
| `#[cfg(unix)]` | 按 Unix 目标选择代码块 |
| `#[cfg(target_os = "linux")]` | 仅选择 Linux，比 `unix` 范围更小 |
| `#[cfg(feature = "some-feature")]` | 根据 Cargo feature 是否启用来选择 |
| `cfg!(unix)` | 生成布尔值；用于普通 `if` 时两边仍需要能通过编译，不能代替属性来隔离不存在的平台 API |

### 6.3 · Unix 分支注册和等待信号

```rust
let mut terminate =
    tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        .expect("注册 SIGTERM");

tokio::select! {
    _ = tokio::signal::ctrl_c() => {},
    _ = terminate.recv() => {},
}
```

| 调用 | 主体或接收者 | 做了什么 | 返回值 |
| --- | --- | --- | --- |
| `SignalKind::terminate()` | Tokio Unix 信号类型 | 构造代表 SIGTERM 的信号种类 | `SignalKind` |
| `tokio::signal::unix::signal(kind)` | Tokio Unix 信号模块 | 注册信号监听 | `io::Result<Signal>` |
| `.expect("注册 SIGTERM")` | 上一步 `Result` | 取出监听对象；注册失败时 panic | `Signal` |
| `tokio::signal::ctrl_c()` | Tokio 信号模块 | 创建等待 Ctrl+C 的异步计算；Unix 下对应 SIGINT | future，完成后为 `io::Result<()>` |
| `terminate.recv()` | `terminate`，以 `&mut self` 接收 | 等待下一次 SIGTERM 通知 | future，完成后为 `Option<()>` |
| `tokio::select! { ... }` | Tokio 宏 | 并发等待分支，选中先完成且匹配的分支 | 本例分支体都是 `{}`，结果为 `()` |

`terminate` 必须是 `mut`，因为 `recv` 需要可变借用接收器。`recv()` 的 `Some(())` 表示收到通知，`None` 表示信号流结束。

原注释中的“中断信号量”并不准确：这里监听的是操作系统信号，与 `AppState` 中控制并发数量的 `Semaphore` 信号量是两种机制。

`select!` 在同一个任务中并发轮询多个 future，不会自动为每个分支创建线程。任意分支完成后，执行对应分支体，其他未完成分支的 future 会被丢弃；取消是否安全取决于具体 API，不能把这个结论推广成“所有异步操作都能随时安全取消”。

当前左侧模式都是 `_`，会匹配任何返回结果：`ctrl_c()` 返回 `Err` 或 `recv()` 返回 `None` 时，也会结束等待。`.expect` 的信号注册失败则会 panic，不会变成 `main` 的 `Err`。

### 6.4 · 非 Unix 分支为什么写 `let _ = ...`

```rust
let _ = tokio::signal::ctrl_c().await;
```

`.await` 后为 `io::Result<()>`，`let _ =` 显式丢弃结果，因此不会处理注册或等待错误。该语句完成后，`shutdown` 到达末尾，隐式返回 `()`。

如果希望单独记录错误，可以在替代实现中写：

```rust
if let Err(error) = tokio::signal::ctrl_c().await {
    tracing::error!(%error, "等待关闭信号失败");
}
```

这仍然会在记录错误后返回 `()` 并触发关闭；若希望失败时保持服务运行，需要另外设计错误策略，不能只更换日志语句。

### 6.5 · 优雅关闭和数据库连接池关闭

```rust
server.await?;
state.db.close().await;
Ok(())
```

正常顺序是：关闭信号 future 完成 → Axum 停止接收新连接并通知现有连接关闭 → 等待连接处理结束 → `server.await` 返回 → 关闭连接池 → 返回成功。

在当前 Axum 0.8.9 实现中，`WithGracefulShutdown` 的等待结果类型是 `io::Result<()>`，其正常完成路径实际构造的是 `Ok(())`。不要据此声称它会把每个 handler 的业务错误返回到 `main`；请求错误和服务器等待结果是不同层次。

`state.db` 的类型是 `sqlx::PgPool`，它是 PostgreSQL 连接池的别名。`.close()` 以 `&self` 借用池对象，返回 `impl Future<Output = ()>`，所以这里只需要 `.await`，没有 `?`。

池关闭后不再提供新连接，并等待已借出的连接归还、完成连接关闭。所有克隆句柄共享这一关闭状态；它不会只关闭 `main` 持有的外层句柄。

为什么先停 HTTP 再关池？因为尚未完成的请求可能还要执行 SQL；如果先关闭池，就可能让这些请求在正常收尾前失去数据库连接。

需要理解的边界：

- 当前没有设置统一的关闭期限。长请求、持续连接或长期占用的数据库连接可能延长退出等待。
- 启动阶段任何一个 `?` 提前返回，都不会执行末尾这条显式 `close()`。局部值会按 Rust 的释放规则清理，但这不等同于等待异步关闭流程完成。
- 从一般控制流看，`server.await?` 若返回错误也会跳过显式关池；但本版本 Axum 的这个优雅关闭包装正常完成实现返回 `Ok(())`，应区分“类型允许错误”和“当前实现实际产生错误”。
- `SIGKILL` 无法被这段逻辑捕获；进程被强制终止时，不会执行这里的优雅关闭代码。
- 这些平台行为依据源码解释，本文未进行跨平台启动或信号实测。

### 6.6 · 同类等待与关闭操作的区别

| 操作 | 返回值或效果 | 适用场景和区别 |
| --- | --- | --- |
| `tokio::select!` | 返回被选中分支体的值 | 等待多个条件之一完成，例如 Ctrl+C 或 SIGTERM |
| `tokio::join!(a, b)` | future 输出组成的元组 | 等待两个都完成；若用于这里，会需要两种信号等待都结束 |
| `tokio::try_join!(a, b)` | 成功输出元组的 `Result` | 全部成功才成功，遇到一个错误就提前返回；要求分支输出为兼容的 `Result` |
| `tokio::time::timeout(duration, future).await` | `Result<F::Output, Elapsed>` | 给等待过程设置期限；超时丢弃 future，不保证底层操作自动完成清理 |
| `drop(pool)` | `()` | 释放一个句柄；其他克隆还可能存在，且不会在此等待异步关池 |
| `pool.close().await` | `()` | 显式关闭共享连接池，并等待关闭完成 |
| `std::process::exit(code)` | `!`，不返回 | 立即终止进程，不执行普通栈展开和局部析构，不能替代上述收尾 |

例如下面的片段只说明如何限制**数据库连接池关闭**的等待时间，它不会限制前面的 HTTP 排空时间，也不是保证清理完成的方案：

```rust
use std::time::Duration;

if tokio::time::timeout(Duration::from_secs(10), state.db.close())
    .await
    .is_err()
{
    tracing::warn!("等待数据库连接池关闭超时");
}
```

如果要给整个服务退出设置期限，应同时考虑 HTTP 连接排空、后台任务和数据库收尾，不能只给最后一行添加超时。

### 6.7 · 手动观察关闭的方式

在开发环境中，服务成功运行后，可在前台终端按 Ctrl+C。Unix 环境也可以对确认过的服务进程发送 SIGTERM：

```bash
kill -TERM <服务进程PID>
```

`<服务进程PID>` 是占位符，需要替换为实际服务进程号。这里的命令是学习用的手动验证方式，本文没有实际启动或终止任何服务。

## 参考资料与后续阅读

项目源码是上述项目行为的依据：

- [main.rs](../../src/main.rs)：入口和信号处理。
- [config.rs](../../src/config.rs)：配置来源、默认值和校验。
- [state.rs](../../src/state.rs)：连接池、文件探针和共享资源初始化。
- [app.rs](../../src/app.rs)：路由、中间件和状态注入。
- [client_ip.rs](../../src/middleware/client_ip.rs)：连接对端和代理地址识别。
- [GeoLookup::load](../../src/modules/access/geoip.rs)：启动时区域目录的数据库操作。
- [程序配置(config.rs).md](程序配置(config.rs).md)：配置专题文档。

第三方 API 可继续对照官方文档和本地 Cargo 依赖源码阅读：

- [Rust：错误传播与 `?`](https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html)。
- [Tokio：`#[tokio::main]`](https://docs.rs/tokio/1.54.1/tokio/attr.main.html) 和 [`select!`](https://docs.rs/tokio/1.54.1/tokio/macro.select.html)。
- [tracing-subscriber：`EnvFilter`](https://docs.rs/tracing-subscriber/0.3.23/tracing_subscriber/filter/struct.EnvFilter.html) 和 [`SubscriberBuilder`](https://docs.rs/tracing-subscriber/0.3.23/tracing_subscriber/fmt/struct.SubscriberBuilder.html)。
- [Axum：`Serve::with_graceful_shutdown`](https://docs.rs/axum/0.8.9/axum/serve/struct.Serve.html#method.with_graceful_shutdown)，说明关闭 future 的要求及等待结果。
- [SQLx：`Pool::close`](https://docs.rs/sqlx/0.8.6/sqlx/struct.Pool.html#method.close)。
