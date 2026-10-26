use backend::{cli, config::Config, state::AppState};
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    if std::env::args().len() != 1 {
        return Err("密码只能交互输入，不能放在命令行".into());
    }
    let password = rpassword::prompt_password("新密码（将撤销全部会话）：")?;
    if password != rpassword::prompt_password("再次输入密码：")? {
        return Err("两次密码不一致".into());
    }
    let state = AppState::new(&Config::from_env()?).await?;
    cli::reset_password(&state, password)
        .await
        .map_err(std::io::Error::other)?;
    state.db.close().await;
    println!("密码已重设，全部会话已撤销");
    Ok(())
}
