import { useDashboard } from "../../../../shared/queries/dashboard";
import { useUrlFilters } from "../../../../shared/hooks/useUrlFilters";
import { useSeo } from "../../../../shared/hooks/useSeo";
import { isKind } from "../../../../shared/utils/content";
import { number } from "../../../../shared/utils/date";
import { PageHeading } from "../../../../shared/components/ui/page-heading/PageHeading";
import { Button, ButtonLink } from "../../../../shared/components/ui/button/Button";
import { ErrorNotice } from "../../../../shared/components/ui/error-notice/ErrorNotice";
import { ContentLibrary } from "../../../../shared/components/content/content-library/ContentLibrary";
import styles from "../../../../shared/components/content/content-library/ContentLibrary.module.css";
const kindLabels = { blog: "技术博客", project: "项目作品", life: "生活记录" };
const statuses = { published: "已发布", draft: "草稿", archived: "已归档" };
export default function Page() {
  const { params, page, update } = useUrlFilters();
  const rawKind = params.get("kind");
  const kind = isKind(rawKind) ? rawKind : undefined;
  const rawStatus = params.get("status") || "";
  const status = Object.hasOwn(statuses, rawStatus) ? rawStatus : "";
  const q = params.get("q") || "";
  const rawSort = params.get("sort") || "updated_desc";
  const sort = ["updated_desc", "created_desc", "sort_asc"].includes(rawSort) ? rawSort : "updated_desc";
  const dashboard = useDashboard();
  const title = kind ? `${kindLabels[kind]}管理` : "内容管理";
  useSeo(title);
  const count = (type?: string, state?: string) => dashboard.data
    ? number(dashboard.data.counts.filter((row) => (!type || row.kind === type) && (!state || row.status === state)).reduce((sum, row) => sum + row.count, 0)) : "—";
  return <div className={styles.page}>
    <PageHeading eyebrow="CONTENT / LIBRARY" title={title} description="管理博客、作品与生活，让每一次分享都有清晰的表达。"
      actions={<ButtonLink variant="primary" className={styles.newButton} to={`/admin/contents/new?kind=${kind || "blog"}`}>＋ {kind === "blog" ? "新建文章" : kind === "project" ? "新建作品" : kind === "life" ? "新建记录" : "新建内容"}</ButtonLink>} />
    <div className={styles.stats} aria-label="内容状态统计">
      {Object.entries(statuses).map(([value, label]) => <section key={value} data-status={value}><span>{label}</span><strong>{count(kind, value)}</strong></section>)}
    </div>
    {dashboard.error && <div className={styles.summaryError}><ErrorNotice error={dashboard.error} /><Button variant="ghost" onClick={() => void dashboard.refetch()}>重试统计</Button></div>}
    <ContentLibrary filters={{ page, kind, status: status || undefined, q, sort }} onChange={update} header={
<div className={styles.tabs} role="group" aria-label="内容类型筛选">
        {[["", "全部内容"], ...Object.entries(kindLabels)].map(([value, label]) => <button key={value} type="button" aria-pressed={(kind || "") === value} onClick={() => update({ kind: value })}>{label}<small>{count(value || undefined)}</small></button>)}
      </div>
    } />
  </div>;
}
