use super::{dto::VisitsQuery, model::VisitEvent};
use crate::{common::pagination::literal_like, error::AppResult};
use chrono::{DateTime, NaiveDate, Utc};
use serde_json::{Value, json};
use sqlx::PgPool;
pub async fn insert_event_repository(pool: &PgPool, v: &VisitEvent) -> AppResult<()> {
    sqlx::query(r#"
            INSERT INTO visit_events(id,event_id,occurred_at,visitor_hash,hash_key_version,client_ip,region_id,region_label,network_label,page_path,page_title,content_id,source,device) 
            VALUES($1,$2,$3,$4,$5,$6::inet,$7,$8,$9,$10,$11,$12,$13,$14) 
            ON CONFLICT(event_id) DO NOTHING
            "#).bind(v.id).bind(v.event_id).bind(v.occurred_at).bind(&v.visitor_hash).bind(v.key_version).bind(&v.ip).bind(&v.region_id).bind(&v.region_label).bind(&v.network_label).bind(&v.page_path).bind(&v.page_title).bind(v.content_id).bind(&v.source).bind(&v.device).execute(pool).await?;
    Ok(())
}
pub async fn analytics_repository(
    pool: &PgPool,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    previous: DateTime<Utc>,
    first_date: NaiveDate,
    last_date: NaiveDate,
) -> AppResult<Value> {
    let mut tx = pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *tx)
        .await?;
    let(pv,uv):(i64,i64)=sqlx::query_as("SELECT count(*),count(DISTINCT visitor_hash) FROM visit_events WHERE occurred_at>=$1 AND occurred_at<$2").bind(start).bind(end).fetch_one(&mut *tx).await?;
    let(old_pv,old_uv):(i64,i64)=sqlx::query_as("SELECT count(*),count(DISTINCT visitor_hash) FROM visit_events WHERE occurred_at>=$1 AND occurred_at<$2").bind(previous).bind(start).fetch_one(&mut *tx).await?;
    let series:Vec<(Value,)>=sqlx::query_as(r#"
            SELECT jsonb_build_object('date',d::date,'pv',count(v.id),'uv',count(DISTINCT v.visitor_hash)) 
            FROM generate_series($1::date::timestamp,$2::date::timestamp,interval '1 day') d 
            LEFT 
            JOIN visit_events v 
            ON (v.occurred_at AT TIME ZONE 'Asia/Shanghai')::date=d::date 
            GROUP BY d 
            ORDER BY d
            "#).bind(first_date).bind(last_date).fetch_all(&mut *tx).await?;
    let sources: Vec<(Value,)> = sqlx::query_as(
        r#"
            SELECT jsonb_build_object('source',source,'pv',count(*)) 
            FROM visit_events 
            WHERE occurred_at>=$1 
            AND occurred_at<$2 
            GROUP BY source 
            ORDER BY source
            "#,
    )
    .bind(start)
    .bind(end)
    .fetch_all(&mut *tx)
    .await?;
    let devices: Vec<(Value,)> = sqlx::query_as(
        r#"
            SELECT jsonb_build_object('device',device,'pv',count(*)) 
            FROM visit_events 
            WHERE occurred_at>=$1 
            AND occurred_at<$2 
            GROUP BY device 
            ORDER BY device
            "#,
    )
    .bind(start)
    .bind(end)
    .fetch_all(&mut *tx)
    .await?;
    let popular:Vec<(Value,)>=sqlx::query_as(r#"
            SELECT jsonb_build_object('content_id',c.id,'kind',c.kind,'slug',c.slug,'title',c.title,'pv',count(*)) 
            FROM visit_events v 
            JOIN content_items c 
            ON c.id=v.content_id 
            WHERE v.occurred_at>=$1 
            AND v.occurred_at<$2 
            AND c.status='published' 
            GROUP BY c.id 
            ORDER BY count(*) DESC,c.id 
            LIMIT 10
            "#).bind(start).bind(end).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    fn percent(now: i64, old: i64) -> Option<f64> {
        (old > 0).then(|| (now - old) as f64 * 100.0 / old as f64)
    }
    Ok(
        json!({"timezone":"Asia/Shanghai","start_date":first_date,"end_date":last_date,"pv":pv,"uv":uv,"pv_change_percent":percent(pv,old_pv),"uv_change_percent":percent(uv,old_uv),"average_duration_seconds":null,"series":series.into_iter().map(|r|r.0).collect::<Vec<_>>(),"sources":sources.into_iter().map(|r|r.0).collect::<Vec<_>>(),"devices":devices.into_iter().map(|r|r.0).collect::<Vec<_>>(),"popular_contents":popular.into_iter().map(|r|r.0).collect::<Vec<_>>()}),
    )
}
pub async fn visits_repository(
    pool: &PgPool,
    q: &VisitsQuery,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    size: i64,
    offset: i64,
) -> AppResult<(Vec<Value>, i64)> {
    let filter = "WHERE v.occurred_at>=$1 AND v.occurred_at<$2 AND ($3::text IS NULL OR host(v.client_ip) ILIKE $3 OR v.region_label ILIKE $3 OR v.network_label ILIKE $3 OR v.page_title ILIKE $3 OR v.page_path ILIKE $3) AND ($4::text IS NULL OR v.source=$4) AND ($5::text IS NULL OR v.region_id=$5)";
    let pattern = q.q.as_deref().map(literal_like);
    let mut tx = pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *tx)
        .await?;
    let total: i64 = sqlx::query_scalar(&format!("SELECT count(*) FROM visit_events v {filter}"))
        .bind(start)
        .bind(end)
        .bind(&pattern)
        .bind(&q.source)
        .bind(&q.region_id)
        .fetch_one(&mut *tx)
        .await?;
    let rows:Vec<(Value,)>=sqlx::query_as(&format!("SELECT jsonb_build_object('id',v.id,'occurred_at',v.occurred_at,'ip',host(v.client_ip),'region_id',v.region_id,'region_label',v.region_label,'network_label',v.network_label,'page_path',v.page_path,'page_title',v.page_title,'content_id',v.content_id,'source',v.source,'device',v.device,'matched_rule_ids',COALESCE((SELECT jsonb_agg(a.id ORDER BY a.id) FROM access_rules a WHERE a.enabled AND (a.expires_at IS NULL OR a.expires_at>now()) AND (a.ip=v.client_ip OR a.region_id=v.region_id)),'[]'::jsonb)) FROM visit_events v {filter} ORDER BY v.occurred_at DESC,v.id DESC LIMIT $6 OFFSET $7")).bind(start).bind(end).bind(&pattern).bind(&q.source).bind(&q.region_id).bind(size).bind(offset).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok((rows.into_iter().map(|r| r.0).collect(), total))
}

pub async fn published_path_repository(
    pool: &PgPool,
    kind: &str,
    slug: &str,
) -> AppResult<Option<(uuid::Uuid, String)>> {
    Ok(sqlx::query_as(
        "SELECT id,title FROM content_items WHERE kind=$1 AND slug=$2 AND status='published'",
    )
    .bind(kind)
    .bind(slug)
    .fetch_optional(pool)
    .await?)
}
pub async fn region_exists_repository(pool: &PgPool, id: &str) -> AppResult<bool> {
    Ok(
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM region_catalog WHERE id=$1)")
            .bind(id)
            .fetch_one(pool)
            .await?,
    )
}

pub async fn maintenance_records_repository(
    pool: &PgPool,
    now: DateTime<Utc>,
) -> AppResult<(u64, u64, u64)> {
    let today = crate::modules::analytics::service::today(now);
    let first = today - chrono::Duration::days(59);
    let year = today - chrono::Duration::days(364);
    let mut tx = pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock(73810926)")
        .execute(&mut *tx)
        .await?;
    let sessions =
        sqlx::query("DELETE FROM admin_sessions WHERE expires_at<=$1 OR absolute_expires_at<=$1")
            .bind(now)
            .execute(&mut *tx)
            .await?
            .rows_affected();
    let events = sqlx::query(
        "DELETE FROM visit_events WHERE (occurred_at AT TIME ZONE 'Asia/Shanghai')::date<$1",
    )
    .bind(first)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    let audit = sqlx::query("DELETE FROM audit_logs WHERE created_at<$1")
        .bind(now - chrono::Duration::days(180))
        .execute(&mut *tx)
        .await?
        .rows_affected();
    sqlx::query("DELETE FROM analytics_daily WHERE date>=$1 OR date<$2")
        .bind(first)
        .bind(year)
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        r#"
            WITH events AS (
            SELECT *, (occurred_at AT TIME ZONE 'Asia/Shanghai')::date AS day 
            FROM visit_events), counts AS (
            SELECT day,count(*) AS pv,count(DISTINCT visitor_hash) AS uv 
            FROM events 
            GROUP BY day) 
            INSERT INTO analytics_daily(date,pv,uv,source_counts,device_counts) 
            SELECT c.day,c.pv,c.uv,COALESCE((
            SELECT jsonb_object_agg(source,n) 
            FROM (
            SELECT source,count(*) n 
            FROM events x 
            WHERE x.day=c.day 
            GROUP BY source) a),'{}'::jsonb),COALESCE((
            SELECT jsonb_object_agg(device,n) 
            FROM (
            SELECT device,count(*) n 
            FROM events x 
            WHERE x.day=c.day 
            GROUP BY device) a),'{}'::jsonb) 
            FROM counts c
            "#,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok((sessions, events, audit))
}
