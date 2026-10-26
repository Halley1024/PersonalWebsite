use super::model::{ContentIdentity, GalleryRow};
use crate::{
    common::pagination::literal_like,
    error::{AppError, AppResult},
};
use serde_json::Value;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;
// SQL 中只构建展示摘要，不返回媒体存储键。
fn media(alias: &str) -> String {
    format!(
        "CASE WHEN {alias}.id IS NULL OR {alias}.state<>'ready' THEN NULL ELSE jsonb_build_object('id',{alias}.id,'url','/api/v1/media/'||{alias}.id,'width',{alias}.width,'height',{alias}.height,'alt',{alias}.alt) END"
    )
}
fn fields(detail: bool) -> String {
    let cover = media("m");
    let body = if detail {
        "'body_markdown',c.body_markdown,'seo_title',c.seo_title,'seo_description',c.seo_description,'cover_media_id',c.cover_media_id,'category_id',c.category_id,"
    } else {
        ""
    };
    format!(
        r#"jsonb_build_object('id',c.id,'kind',c.kind,'slug',c.slug,'title',c.title,'excerpt',c.excerpt,{body}
    'featured',c.featured,'sort_order',c.sort_order,'status',c.status,'version',c.version,'created_at',c.created_at,'updated_at',c.updated_at,'published_at',c.published_at,
    'cover',{cover},'category',CASE WHEN cat.id IS NULL THEN NULL ELSE jsonb_build_object('id',cat.id,'name',cat.name,'slug',cat.slug) END,
    'tags',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'slug',t.slug) ORDER BY t.name,t.id) FROM content_tags ct JOIN tags t ON t.id=ct.tag_id WHERE ct.content_id=c.id),'[]'::jsonb),
    'project',CASE WHEN p.content_id IS NULL THEN NULL ELSE to_jsonb(p)-'content_id'-'kind' END,
    'life',CASE WHEN l.content_id IS NULL THEN NULL ELSE to_jsonb(l)-'content_id'-'kind' END)"#
    )
}
const JOINS: &str = "FROM content_items c LEFT JOIN media_files m ON m.id=c.cover_media_id LEFT JOIN categories cat ON cat.id=c.category_id LEFT JOIN project_details p ON p.content_id=c.id LEFT JOIN life_details l ON l.content_id=c.id";
pub async fn lock_content_repository(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
) -> AppResult<ContentIdentity> {
    sqlx::query_as("SELECT kind,status,version FROM content_items WHERE id=$1 FOR UPDATE")
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(AppError::missing)
}
pub async fn find_detail_repository(
    pool: &PgPool,
    id: Option<Uuid>,
    kind: Option<&str>,
    slug: Option<&str>,
    public: bool,
) -> AppResult<Value> {
    // 多表读取使用同一快照，避免正文、标签和图库拼接不同提交版本。
    let mut tx = pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *tx)
        .await?;
    let row:Option<(Value,)>=sqlx::query_as(&format!("SELECT {} {JOINS} WHERE ($1::uuid IS NULL OR c.id=$1) AND ($2::text IS NULL OR c.kind=$2) AND ($3::text IS NULL OR c.slug=$3) AND (NOT $4 OR c.status='published')",fields(true))).bind(id).bind(kind).bind(slug).bind(public).fetch_optional(&mut *tx).await?;
    let mut data = row.ok_or_else(AppError::missing)?.0;
    let actual_id: Uuid =
        serde_json::from_value(data["id"].clone()).map_err(|_| AppError::internal())?;
    let gallery:Vec<GalleryRow>=sqlx::query_as(&format!("SELECT cm.media_id,cm.position,cm.alt,{} AS media FROM content_media cm JOIN media_files gm ON gm.id=cm.media_id WHERE cm.content_id=$1 AND cm.role='gallery' ORDER BY cm.position",media("gm"))).bind(actual_id).fetch_all(&mut *tx).await?;
    let values:Vec<Value>=gallery.into_iter().map(|g|serde_json::json!({"media_id":g.media_id,"position":g.position,"alt":g.alt,"media":g.media})).collect();
    data["gallery"] = serde_json::json!(values);
    data["tag_ids"] = serde_json::json!(
        data["tags"]
            .as_array()
            .unwrap()
            .iter()
            .map(|t| t["id"].clone())
            .collect::<Vec<_>>()
    );
    tx.commit().await?;
    Ok(data)
}
#[allow(clippy::too_many_arguments)]
pub async fn list_content_repository(
    pool: &PgPool,
    kind: Option<&str>,
    status: Option<&str>,
    q: Option<&str>,
    category: Option<&str>,
    tag: Option<&str>,
    featured: Option<bool>,
    sort: &str,
    size: i64,
    offset: i64,
) -> AppResult<(Vec<Value>, i64)> {
    let filter = "WHERE ($1::text IS NULL OR c.kind=$1) AND ($2::text IS NULL OR c.status=$2) AND ($3::text IS NULL OR c.title ILIKE $3 OR c.excerpt ILIKE $3) AND ($4::text IS NULL OR cat.slug=$4) AND ($5::text IS NULL OR EXISTS(SELECT 1 FROM content_tags ct JOIN tags t ON t.id=ct.tag_id WHERE ct.content_id=c.id AND t.slug=$5)) AND ($6::boolean IS NULL OR c.featured=$6)";
    let order = match sort {
        "published" => "c.published_at DESC,c.id DESC",
        "project" => "c.sort_order,c.published_at DESC,c.id DESC",
        "life" => "l.occurred_on DESC,c.published_at DESC,c.id DESC",
        "updated_desc" => "c.updated_at DESC,c.id DESC",
        "created_desc" => "c.created_at DESC,c.id DESC",
        "sort_asc" => "c.sort_order,c.updated_at DESC,c.id DESC",
        _ => return Err(AppError::bad()),
    };
    let q = q.map(literal_like);
    let mut tx = pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *tx)
        .await?;
    let total: i64 = sqlx::query_scalar(&format!("SELECT count(*) {JOINS} {filter}"))
        .bind(kind)
        .bind(status)
        .bind(&q)
        .bind(category)
        .bind(tag)
        .bind(featured)
        .fetch_one(&mut *tx)
        .await?;
    let rows: Vec<(Value,)> = sqlx::query_as(&format!(
        "SELECT {} {JOINS} {filter} ORDER BY {order} LIMIT $7 OFFSET $8",
        fields(false)
    ))
    .bind(kind)
    .bind(status)
    .bind(&q)
    .bind(category)
    .bind(tag)
    .bind(featured)
    .bind(size)
    .bind(offset)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok((rows.into_iter().map(|r| r.0).collect(), total))
}

pub async fn media_ids_repository(pool: &PgPool, id: Uuid) -> AppResult<Vec<Uuid>> {
    Ok(sqlx::query_scalar(
        r#"
            SELECT cover_media_id 
            FROM content_items 
            WHERE id=$1 
            AND cover_media_id IS NOT NULL 
            UNION 
            SELECT media_id 
            FROM content_media 
            WHERE content_id=$1
            "#,
    )
    .bind(id)
    .fetch_all(pool)
    .await?)
}
pub async fn validate_relations_repository(
    tx: &mut Transaction<'_, Postgres>,
    kind: &str,
    category: Option<Uuid>,
    tags: &[Uuid],
) -> AppResult<()> {
    if let Some(id) = category {
        let found: Option<Uuid> =
            sqlx::query_scalar("SELECT id FROM categories WHERE id=$1 AND kind=$2 FOR KEY SHARE")
                .bind(id)
                .bind(kind)
                .fetch_optional(&mut **tx)
                .await?;
        if found.is_none() {
            return Err(AppError::invalid("category_id", "分类类型不匹配或不存在"));
        }
    }
    let rows: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM tags WHERE id=ANY($1) AND kind=$2 ORDER BY id FOR KEY SHARE",
    )
    .bind(tags)
    .bind(kind)
    .fetch_all(&mut **tx)
    .await?;
    if rows.len() != tags.len() {
        return Err(AppError::invalid("tag_ids", "标签类型不匹配或不存在"));
    }
    Ok(())
}
pub async fn save_content_repository(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    kind: &str,
    create: bool,
    i: &super::dto::ContentInput,
    body_ids: &[Uuid],
) -> AppResult<()> {
    if create {
        sqlx::query(r#"
            INSERT INTO content_items(id,kind,slug,title,excerpt,body_markdown,cover_media_id,category_id,featured,sort_order,seo_title,seo_description) 
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            "#).bind(id).bind(kind).bind(&i.slug).bind(&i.title).bind(&i.excerpt).bind(&i.body_markdown).bind(i.cover_media_id).bind(i.category_id).bind(i.featured).bind(i.sort_order).bind(&i.seo_title).bind(&i.seo_description).execute(&mut **tx).await?;
    } else {
        let affected=sqlx::query(r#"
            UPDATE content_items 
            SET title=$1,excerpt=$2,body_markdown=$3,cover_media_id=$4,category_id=$5,featured=$6,sort_order=$7,seo_title=$8,seo_description=$9,version=version+1,updated_at=now() 
            WHERE id=$10 
            AND version=$11
            "#).bind(&i.title).bind(&i.excerpt).bind(&i.body_markdown).bind(i.cover_media_id).bind(i.category_id).bind(i.featured).bind(i.sort_order).bind(&i.seo_title).bind(&i.seo_description).bind(id).bind(i.version).execute(&mut **tx).await?.rows_affected();
        if affected != 1 {
            return Err(AppError::conflict());
        }
    }
    if let Some(p) = &i.project {
        sqlx::query(r#"
            INSERT INTO project_details(content_id,started_on,ended_on,tech_stack,repository_url,demo_url,project_stage) 
            VALUES($1,$2,$3,$4,$5,$6,$7) 
            ON CONFLICT(content_id) DO 
            UPDATE 
            SET started_on=excluded.started_on,ended_on=excluded.ended_on,tech_stack=excluded.tech_stack,repository_url=excluded.repository_url,demo_url=excluded.demo_url,project_stage=excluded.project_stage
            "#).bind(id).bind(p.started_on).bind(p.ended_on).bind(sqlx::types::Json(&p.tech_stack)).bind(&p.repository_url).bind(&p.demo_url).bind(&p.project_stage).execute(&mut **tx).await?;
    }
    if let Some(l) = &i.life {
        sqlx::query(
            r#"
            INSERT INTO life_details(content_id,occurred_on,location_label) 
            VALUES($1,$2,$3) 
            ON CONFLICT(content_id) DO 
            UPDATE 
            SET occurred_on=excluded.occurred_on,location_label=excluded.location_label
            "#,
        )
        .bind(id)
        .bind(l.occurred_on)
        .bind(&l.location_label)
        .execute(&mut **tx)
        .await?;
    }
    sqlx::query("DELETE FROM content_tags WHERE content_id=$1")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    for tag in &i.tag_ids {
        sqlx::query("INSERT INTO content_tags(content_id,tag_id,kind) VALUES($1,$2,$3)")
            .bind(id)
            .bind(tag)
            .bind(kind)
            .execute(&mut **tx)
            .await?;
    }
    sqlx::query("DELETE FROM content_media WHERE content_id=$1")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    for media in body_ids {
        sqlx::query("INSERT INTO content_media(content_id,media_id,role) VALUES($1,$2,'body')")
            .bind(id)
            .bind(media)
            .execute(&mut **tx)
            .await?;
    }
    for g in &i.gallery {
        sqlx::query("INSERT INTO content_media(content_id,media_id,role,position,alt) VALUES($1,$2,'gallery',$3,$4)").bind(id).bind(g.media_id).bind(g.position).bind(&g.alt).execute(&mut **tx).await?;
    }
    Ok(())
}
pub async fn status_repository(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    status: &str,
) -> AppResult<()> {
    sqlx::query(r#"
            UPDATE content_items 
            SET status=$1,version=version+1,updated_at=now(),published_at=CASE WHEN $1='published' THEN COALESCE(published_at,now()) ELSE published_at END 
            WHERE id=$2
            "#).bind(status).bind(id).execute(&mut **tx).await?;
    Ok(())
}
pub async fn delete_repository(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> AppResult<()> {
    sqlx::query("DELETE FROM content_items WHERE id=$1")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn counts_repository(pool: &PgPool) -> AppResult<Vec<super::model::ContentCount>> {
    Ok(sqlx::query_as(
        r#"
            SELECT k::text AS kind,s::text AS status,count(c.id) AS count 
            FROM unnest(ARRAY['blog','project','life']) k CROSS 
            JOIN unnest(ARRAY['draft','published','archived']) s 
            LEFT 
            JOIN content_items c 
            ON c.kind=k 
            AND c.status=s 
            GROUP BY k,s 
            ORDER BY k,s
            "#,
    )
    .fetch_all(pool)
    .await?)
}

pub async fn sitemap_repository(pool: &PgPool) -> AppResult<Vec<(String, String)>> {
    Ok(sqlx::query_as(
        "SELECT kind,slug FROM content_items WHERE status='published' ORDER BY kind,slug",
    )
    .fetch_all(pool)
    .await?)
}
