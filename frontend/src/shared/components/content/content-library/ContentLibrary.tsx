import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Image as ImageIcon, Search } from "lucide-react";
import type { AdminCard } from "../../../api/generated";
import type { AdminFilters } from "../../../api/content";
import { useAdminContents, useContentMutations } from "../../../queries/content";
import { kindNames } from "../../../utils/content";
import { date, number } from "../../../utils/date";
import { Button } from "../../ui/button/Button";
import { QueryState } from "../../ui/query-state/QueryState";
import { Badge } from "../../ui/badge/Badge";
import { ConfirmDialog } from "../../ui/confirm-dialog/ConfirmDialog";
import { useToast } from "../../ui/toast/ToastProvider";
import { ContentPreview } from "./ContentPreview";
import { LibraryPagination } from "./LibraryPagination";
import styles from "./ContentLibrary.module.css";
type Action = { item: AdminCard; type: "draft" | "published" | "archived" | "delete" };
const statuses = { published: "已发布", draft: "草稿", archived: "已归档" };
export type LibraryChange = (values: Record<string, string | number | undefined>, keepPage?: boolean) => void;
export function ContentLibrary({ filters, onChange: update, header, renderActions }: { filters: AdminFilters; onChange: LibraryChange; header?: ReactNode; renderActions?: (item: AdminCard, preview: () => void) => ReactNode }) {
  const { kind, page = 1, status = "", q = "", sort = "updated_desc" } = filters;
  const query = useAdminContents({ ...filters, page, page_size: 8, q, sort, status: status || undefined });
  const [action, setAction] = useState<Action>();
  const [preview, setPreview] = useState<string>();
  const mutations = useContentMutations();
  const toast = useToast();
  useEffect(() => {
    if (query.data && page > Math.max(1, query.data.meta.total_pages)) update({ page: Math.max(1, query.data.meta.total_pages) }, true);
  }, [query.data, page]);
  const clear = () => update({ q: "", status: "", sort: "" });
  const labels = { draft: "恢复为草稿", published: "发布", archived: "归档", delete: "永久删除" };
  async function confirm() {
    if (!action) return;
    const { item, type } = action;
    if (type === "delete") await mutations.remove.mutateAsync({ id: item.id, version: item.version });
    else await mutations.status.mutateAsync({ id: item.id, body: { status: type, version: item.version } });
    toast("操作已完成");
  }
  const timeLabel = (item: AdminCard) => item.kind === "project"
    ? item.project ? `${item.project.started_on} — ${item.project.ended_on || "至今"}` : "未设置项目时间"
    : item.kind === "life" ? item.life?.occurred_on || "未设置发生时间" : date(item.updated_at, true);
  return <>
    <section className={styles.library} aria-label="内容库">
      {header}
      <div className={styles.toolbar}>
        <label className={styles.search}><Search size={17} aria-hidden="true" /><input type="search" aria-label="搜索内容" placeholder="搜索标题或摘要…" maxLength={100} value={q} onChange={(e) => update({ q: e.target.value })} /></label>
        <label className={styles.filter}>状态<select aria-label="内容状态" value={status} onChange={(e) => update({ status: e.target.value })}><option value="">全部状态</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className={styles.filter}>排序<select aria-label="排序" value={sort} onChange={(e) => update({ sort: e.target.value })}><option value="updated_desc">最近更新</option><option value="created_desc">最近创建</option><option value="sort_asc">排序值升序</option></select></label>
        <span className={styles.result} role="status">{query.data ? `共 ${number(query.data.meta.total)} 篇内容` : "正在读取内容…"}</span>
      </div>
      <QueryState loading={query.isPending} error={query.error} empty={query.data?.data.length === 0} emptyText="还没有匹配的内容，试试其他关键词或清除当前筛选。" emptyAction={<Button variant="ghost" onClick={clear}>清除筛选</Button>} retry={() => void query.refetch()}>
        <div className={styles.tableScroll} role="region" aria-label="内容列表" tabIndex={0}><table className={styles.table}>
          <thead><tr><th scope="col">文章 / 简介</th><th scope="col">类型</th><th scope="col">状态</th><th scope="col">{kind === "project" ? "项目周期" : kind === "life" ? "发生时间" : kind === "blog" ? "更新时间" : "内容时间"}</th><th scope="col">操作</th></tr></thead>
          <tbody>{query.data?.data.map((item) => <tr key={item.id}>
            <td><div className={styles.contentCell}><div className={styles.cover}>{item.cover ? <img src={item.cover.url} alt={item.cover.alt || ""} loading="lazy" /> : <span aria-hidden="true"><ImageIcon size={20} /></span>}</div><div className={styles.contentText}><Link to={`/admin/contents/${item.id}/edit`} title={item.title}>{item.title}</Link><p title={item.excerpt}>{item.excerpt}</p></div></div></td>
            <td><span className={styles.type} data-kind={item.kind}>{kindNames[item.kind]}</span></td>
            <td><Badge value={item.status} /></td>
            <td><time className={styles.time} title={timeLabel(item)}>{timeLabel(item)}</time></td>
            <td><div className={styles.actions}>
              {renderActions ? renderActions(item, () => setPreview(item.id)) : <>
              <Link to={`/admin/contents/${item.id}/edit`}>{item.status === "archived" ? "查看" : "编辑"}</Link>
              <button type="button" onClick={() => setPreview(item.id)}>预览</button>
              {item.status === "draft" && <button type="button" onClick={() => setAction({ item, type: "published" })}>发布</button>}
              {item.status === "published" && <button type="button" onClick={() => setAction({ item, type: "draft" })}>下线</button>}
              {item.status !== "archived" && <button type="button" onClick={() => setAction({ item, type: "archived" })}>归档</button>}
              {item.status === "archived" && <button type="button" onClick={() => setAction({ item, type: "draft" })}>恢复</button>}
              {item.status !== "published" && <button type="button" className={styles.danger} onClick={() => setAction({ item, type: "delete" })}>删除</button>}
              </>}
            </div></td>
          </tr>)}</tbody>
        </table></div>
      </QueryState>
      {query.data && <LibraryPagination page={page} meta={query.data.meta} onChange={(page) => update({ page }, true)} />}
    </section>
    {preview && <ContentPreview id={preview} onClose={() => setPreview(undefined)} />}
    <ConfirmDialog open={!!action} title={action ? `${labels[action.type]}内容` : ""}
      description={action?.type === "delete" ? `将永久删除“${action.item.title}”，此操作无法通过应用恢复。` : action ? `确认${labels[action.type]}“${action.item.title}”？发布状态会影响访客对正文及图片的访问。` : ""}
      confirmText={action ? labels[action.type] : "确认"} danger={action?.type === "delete"} onClose={() => setAction(undefined)} onConfirm={confirm} />
  </>;
}
