import { useContentMutations } from "../../../../shared/queries/content";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { AdminCard } from "../../../../shared/api/generated";
import { useAdminContents } from "../../../../shared/queries/content";
import { useUrlFilters } from "../../../../shared/hooks/useUrlFilters";
import { useSeo } from "../../../../shared/hooks/useSeo";
import { kindNames, isKind } from "../../../../shared/utils/content";
import { date } from "../../../../shared/utils/date";
import { PageHeading } from "../../../../shared/components/ui/page-heading/PageHeading";
import { ButtonLink } from "../../../../shared/components/ui/button/Button";
import { QueryState } from "../../../../shared/components/ui/query-state/QueryState";
import { Pagination } from "../../../../shared/components/ui/pagination/Pagination";
import { Badge } from "../../../../shared/components/ui/badge/Badge";
import { ConfirmDialog } from "../../../../shared/components/ui/confirm-dialog/ConfirmDialog";
import { useToast } from "../../../../shared/components/ui/toast/ToastProvider";
import table from "../../../../shared/styles/table.module.css";
import forms from "../../../../shared/styles/forms.module.css";
import styles from "./Page.module.css";
type Action = {
  item: AdminCard;
  type: "draft" | "published" | "archived" | "delete";
};
export default function Page() {
  const { params, page, update } = useUrlFilters();
  const kind = params.get("kind");
  const status = params.get("status") || "";
  const q = params.get("q") || "";
  const query = useAdminContents({
    page,
    page_size: 20,
    kind: isKind(kind) ? kind : undefined,
    status: ["draft", "published", "archived"].includes(status)
      ? status
      : undefined,
    q,
    sort: params.get("sort") || "updated_desc",
  });
  const [action, setAction] = useState<Action>();
  const mutations = useContentMutations();
  const toast = useToast();
  useSeo("内容管理");
  const labels = {
    draft: "恢复为草稿",
    published: "发布",
    archived: "归档",
    delete: "永久删除",
  };
  async function confirm() {
    if (!action) return;
    const { item, type } = action;
    if (type === "delete")
      await mutations.remove.mutateAsync({
        id: item.id,
        version: item.version,
      });
    else
      await mutations.status.mutateAsync({
        id: item.id,
        body: { status: type, version: item.version },
      });
    toast("操作已完成");
  }
  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="CONTENT / LIBRARY"
        title="内容管理"
        description="管理博客、作品与生活，让每次分享都有清晰的表达。"
        actions={
          <ButtonLink
            to={`/admin/contents/new?kind=${isKind(kind) ? kind : "blog"}`}
          >
            ＋ 新建内容
          </ButtonLink>
        }
      />
      <div className={styles.tabs}>
        {[
          ["", "全部内容"],
          ["blog", "技术博客"],
          ["project", "项目作品"],
          ["life", "生活记录"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={(kind || "") === value ? styles.active : ""}
            onClick={() => update({ kind: value })}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={forms.toolbar}>
        <input
          type="search"
          aria-label="搜索内容"
          placeholder="搜索标题或摘要…"
          maxLength={100}
          value={q}
          onChange={(e) => update({ q: e.target.value })}
        />
        <select
          aria-label="内容状态"
          value={status}
          onChange={(e) => update({ status: e.target.value })}
        >
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
          <option value="archived">已归档</option>
        </select>
        <select
          aria-label="排序"
          value={params.get("sort") || "updated_desc"}
          onChange={(e) => update({ sort: e.target.value })}
        >
          <option value="updated_desc">最近更新</option>
          <option value="created_desc">最近创建</option>
          <option value="sort_asc">排序值升序</option>
        </select>
      </div>
      <QueryState
        loading={query.isPending}
        error={query.error}
        empty={query.data?.data.length === 0}
        emptyText="还没有匹配的内容，开始记录第一个想法吧。"
        retry={() => void query.refetch()}
      >
        <div className={table.scroll}>
          <table className={table.table}>
            <thead>
              <tr>
                <th>标题 / 摘要</th>
                <th>类型</th>
                <th>状态</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link to={`/admin/contents/${item.id}/edit`}>
                      {item.title}
                    </Link>
                    <small>{item.excerpt.slice(0, 65)}</small>
                  </td>
                  <td>{kindNames[item.kind]}</td>
                  <td>
                    <Badge value={item.status} />
                  </td>
                  <td>{date(item.updated_at, true)}</td>
                  <td>
                    <div className={table.actions}>
                      <Link to={`/admin/contents/${item.id}/edit`}>
                        {item.status === "archived" ? "查看" : "编辑"}
                      </Link>
                      {item.status === "draft" && (
                        <button
                          onClick={() => setAction({ item, type: "published" })}
                        >
                          发布
                        </button>
                      )}
                      {item.status === "published" && (
                        <button
                          onClick={() => setAction({ item, type: "draft" })}
                        >
                          下线
                        </button>
                      )}
                      {item.status !== "archived" && (
                        <button
                          onClick={() => setAction({ item, type: "archived" })}
                        >
                          归档
                        </button>
                      )}
                      {item.status === "archived" && (
                        <button
                          onClick={() => setAction({ item, type: "draft" })}
                        >
                          恢复
                        </button>
                      )}
                      {item.status !== "published" && (
                        <button
                          className={table.danger}
                          onClick={() => setAction({ item, type: "delete" })}
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryState>
      {query.data && (
        <Pagination
          page={page}
          total={query.data.meta.total}
          totalPages={query.data.meta.total_pages}
          onChange={(page) => update({ page }, true)}
        />
      )}
      <ConfirmDialog
        open={!!action}
        title={action ? `${labels[action.type]}内容` : ""}
        description={
          action?.type === "delete"
            ? `将永久删除“${action.item.title}”，此操作无法通过应用恢复。`
            : action
              ? `确认${labels[action.type]}“${action.item.title}”？发布状态会影响访客对正文及图片的访问。`
              : ""
        }
        danger={action?.type === "delete"}
        onClose={() => setAction(undefined)}
        onConfirm={confirm}
      />
    </div>
  );
}
