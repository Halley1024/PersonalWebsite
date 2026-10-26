use backend::{cli, config::Config, state::AppState};
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().skip(1).collect();
    if args.len() != 1 {
        return Err("用法：access-rule-disable <规则 UUID>".into());
    }
    let id = uuid::Uuid::parse_str(&args[0])?;
    let state = AppState::new(&Config::from_env()?).await?;
    cli::disable_rule(&state, id)
        .await
        .map_err(std::io::Error::other)?;
    state.db.close().await;
    println!("规则已禁用并记录审计");
    Ok(())
}
