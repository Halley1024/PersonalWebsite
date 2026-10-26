use backend::{cli, config::Config, state::AppState};
use std::io::{self, Write};
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    if std::env::args().len() != 1 {
        return Err("不接受命令行凭据参数".into());
    }
    print!("管理员用户名：");
    io::stdout().flush()?;
    let mut username = String::new();
    io::stdin().read_line(&mut username)?;
    let password = rpassword::prompt_password("新密码（12–128 字符）：")?;
    if password != rpassword::prompt_password("再次输入密码：")? {
        return Err("两次密码不一致".into());
    }
    let state = AppState::new(&Config::from_env()?).await?;
    cli::create_admin(&state, username.trim().into(), password)
        .await
        .map_err(io::Error::other)?;
    state.db.close().await;
    println!("管理员已创建");
    Ok(())
}
