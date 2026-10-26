use backend::{cli, config::Config, state::AppState};
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().skip(1).collect();
    if args.iter().any(|a| a != "--cleanup-media") || args.len() > 1 {
        return Err("用法：maintenance [--cleanup-media]；默认只报告待清理媒体，始终清理过期数据库记录并重算汇总".into());
    }
    let state = AppState::new(&Config::from_env()?).await?;
    let result = cli::maintenance(&state, !args.is_empty())
        .await
        .map_err(std::io::Error::other)?;
    state.db.close().await;
    println!("{}", serde_json::to_string_pretty(&result)?);
    Ok(())
}
