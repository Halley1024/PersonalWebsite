use serde::Deserialize;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LoginInput {
    pub username: String, // 管理员登录名。
    pub password: String, // 密码输入，不记录日志。
} // 登录请求，密码不派生 Debug。
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PasswordInput {
    pub current_password: String, // 当前密码。
    pub new_password: String,     // 新密码。
} // 修改密码请求。
