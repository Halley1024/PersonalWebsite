use ipnet::IpNet;
use serde::Deserialize;
use sqlx::PgPool;
use std::{net::IpAddr, path::Path};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Entry {
    cidr: IpNet,
    region_id: String,
    label: String,
    lookup_code: String,
    network_label: Option<String>,
}
pub struct GeoLookup {
    entries: Vec<Entry>,
} // 由运维转换并提供的本地 CIDR 目录。
impl GeoLookup {
    pub async fn load(
        path: Option<&Path>,
        db: &PgPool,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let mut entries: Vec<Entry> = if let Some(path) = path {
            serde_json::from_slice(&tokio::fs::read(path).await?)?
        } else {
            vec![]
        };
        entries.sort_by_key(|e| std::cmp::Reverse(e.cidr.prefix_len()));
        let mut tx = db.begin().await?;
        sqlx::query("UPDATE region_catalog SET blockable=false")
            .execute(&mut *tx)
            .await?;
        for e in &entries {
            if e.region_id == "unknown" || e.region_id.is_empty() {
                return Err("区域目录不得覆盖 unknown".into());
            }
            sqlx::query(
                r#"
            INSERT INTO region_catalog(id,label,blockable,lookup_code) 
            VALUES($1,$2,true,$3) 
            ON CONFLICT(id) DO 
            UPDATE 
            SET label=excluded.label,lookup_code=excluded.lookup_code,blockable=true
            "#,
            )
            .bind(&e.region_id)
            .bind(&e.label)
            .bind(&e.lookup_code)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
        Ok(Self { entries })
    }
    pub fn available(&self) -> bool {
        !self.entries.is_empty()
    }
    pub fn lookup(&self, ip: IpAddr) -> (String, String, Option<String>) {
        self.entries
            .iter()
            .find(|e| e.cidr.contains(&ip))
            .map(|e| {
                (
                    e.region_id.clone(),
                    e.label.clone(),
                    e.network_label.clone(),
                )
            })
            .unwrap_or(("unknown".into(), "未知区域".into(), None))
    }
}
