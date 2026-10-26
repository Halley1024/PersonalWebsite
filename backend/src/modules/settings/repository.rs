use super::{dto::SettingsInput, model::Settings};
use sqlx::{PgPool, Postgres, Transaction};
pub async fn find_settings_repository(pool: &PgPool) -> Result<Settings, sqlx::Error> {
    sqlx::query_as(r#"
            SELECT site_name,site_description,footer_text,default_seo_title,default_seo_description,version,updated_at 
            FROM site_settings 
            WHERE id=1
            "#).fetch_one(pool).await
}
pub async fn update_settings_repository(
    tx: &mut Transaction<'_, Postgres>,
    i: &SettingsInput,
) -> Result<bool, sqlx::Error> {
    Ok(sqlx::query(r#"
            UPDATE site_settings 
            SET site_name=$1,site_description=$2,footer_text=$3,default_seo_title=$4,default_seo_description=$5,version=version+1,updated_at=now() 
            WHERE id=1 
            AND version=$6
            "#).bind(&i.site_name).bind(&i.site_description).bind(&i.footer_text).bind(&i.default_seo_title).bind(&i.default_seo_description).bind(i.version).execute(&mut **tx).await?.rows_affected()==1)
}
