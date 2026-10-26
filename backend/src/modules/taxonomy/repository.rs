use crate::error::{AppError, AppResult};
use serde_json::Value;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;
pub fn table(tags: bool) -> &'static str {
    super::model::TaxonomyTable::from(tags).as_str()
}
pub async fn public_taxonomy_repository(
    pool: &PgPool,
    tags: bool,
    kind: &str,
) -> AppResult<Vec<Value>> {
    let usage = if tags {
        "EXISTS(SELECT 1 FROM content_tags ct JOIN content_items c ON c.id=ct.content_id WHERE ct.tag_id=t.id AND c.status='published')"
    } else {
        "EXISTS(SELECT 1 FROM content_items c WHERE c.category_id=t.id AND c.status='published')"
    };
    let rows:Vec<(Value,)>=sqlx::query_as(&format!("SELECT jsonb_build_object('id',id,'name',name,'slug',slug) FROM {} t WHERE kind=$1 AND {usage} ORDER BY name,id",table(tags))).bind(kind).fetch_all(pool).await?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}
pub async fn list_taxonomy_repository(
    pool: &PgPool,
    tags: bool,
    kind: Option<&str>,
    size: i64,
    offset: i64,
) -> AppResult<(Vec<Value>, i64)> {
    let mut tx = pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *tx)
        .await?;
    let t = table(tags);
    let total: i64 = sqlx::query_scalar(&format!(
        "SELECT count(*) FROM {t} WHERE ($1::text IS NULL OR kind=$1)"
    ))
    .bind(kind)
    .fetch_one(&mut *tx)
    .await?;
    let rows:Vec<(Value,)>=sqlx::query_as(&format!("SELECT to_jsonb(t) FROM {t} t WHERE ($1::text IS NULL OR kind=$1) ORDER BY name,id LIMIT $2 OFFSET $3")).bind(kind).bind(size).bind(offset).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok((rows.into_iter().map(|r| r.0).collect(), total))
}
pub async fn get_taxonomy_repository(
    tx: &mut Transaction<'_, Postgres>,
    tags: bool,
    id: Uuid,
) -> AppResult<Value> {
    let r: Option<(Value,)> = sqlx::query_as(&format!(
        "SELECT to_jsonb(t) FROM {} t WHERE id=$1 FOR UPDATE",
        table(tags)
    ))
    .bind(id)
    .fetch_optional(&mut **tx)
    .await?;
    r.map(|r| r.0).ok_or_else(AppError::missing)
}

pub async fn save_taxonomy_repository(
    tx: &mut Transaction<'_, Postgres>,
    tags: bool,
    id: Uuid,
    create: bool,
    value: &Value,
) -> AppResult<()> {
    let name = value["name"].as_str();
    let slug = value["slug"].as_str();
    let sort = value["sort_order"].as_i64().unwrap_or(0) as i32;
    let t = table(tags);
    if create {
        let sql = if tags {
            format!("INSERT INTO {t}(id,kind,name,slug) VALUES($1,$2,$3,$4)")
        } else {
            format!("INSERT INTO {t}(id,kind,name,slug,sort_order) VALUES($1,$2,$3,$4,$5)")
        };
        let q = sqlx::query(&sql)
            .bind(id)
            .bind(value["kind"].as_str())
            .bind(name)
            .bind(slug);
        if tags {
            q.execute(&mut **tx).await?;
        } else {
            q.bind(sort).execute(&mut **tx).await?;
        }
    } else {
        let sql = if tags {
            format!("UPDATE {t} SET name=$1,slug=$2,version=version+1,updated_at=now() WHERE id=$3")
        } else {
            format!(
                "UPDATE {t} SET name=$1,slug=$2,version=version+1,updated_at=now(),sort_order=$4 WHERE id=$3"
            )
        };
        let q = sqlx::query(&sql).bind(name).bind(slug).bind(id);
        if tags {
            q.execute(&mut **tx).await?;
        } else {
            q.bind(sort).execute(&mut **tx).await?;
        }
    }
    Ok(())
}
pub async fn delete_taxonomy_repository(
    tx: &mut Transaction<'_, Postgres>,
    tags: bool,
    id: Uuid,
) -> AppResult<()> {
    sqlx::query(&format!("DELETE FROM {} WHERE id=$1", table(tags)))
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}
