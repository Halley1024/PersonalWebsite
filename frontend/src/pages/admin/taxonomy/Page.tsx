import { useTaxonomyMutations } from "../../../shared/queries/taxonomy";
import { useState } from "react";
import {
  type TaxonomyType,
  type TaxonomyRow,
} from "../../../shared/api/taxonomy";
import { useTaxonomyList } from "../../../shared/queries/taxonomy";
import { useUrlFilters } from "../../../shared/hooks/useUrlFilters";
import { useSeo } from "../../../shared/hooks/useSeo";
import { isKind } from "../../../shared/utils/content";
import { PageHeading } from "../../../shared/components/ui/page-heading/PageHeading";
import { Button } from "../../../shared/components/ui/button/Button";
import { QueryState } from "../../../shared/components/ui/query-state/QueryState";
import { Pagination } from "../../../shared/components/ui/pagination/Pagination";
import { Dialog } from "../../../shared/components/ui/dialog/Dialog";
import { ConfirmDialog } from "../../../shared/components/ui/confirm-dialog/ConfirmDialog";
import { TaxonomyForm } from "./components/TaxonomyForm";
import forms from "../../../shared/styles/forms.module.css";
import table from "../../../shared/styles/table.module.css";
import styles from "./Page.module.css";
export default function Page() {
  const { params, page, update } = useUrlFilters();
  const candidate = params.get("kind");
  const kind = isKind(candidate) ? candidate : "blog";
  const type: TaxonomyType =
    params.get("type") === "tags" ? "tags" : "categories";
  const query = useTaxonomyList(type, { kind, page, page_size: 50 });
  const [edit, setEdit] = useState<{
    item?: TaxonomyRow;
    type: TaxonomyType;
    kind: typeof kind;
  }>();
  const [remove, setRemove] = useState<TaxonomyRow>();
  const mutations = useTaxonomyMutations(type);
  useSeo("分类与标签");
  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="CONTENT / TAXONOMY"
        title="分类与标签"
        description="博客、作品、生活使用各自的分类与标签目录。"
        actions={
          <Button onClick={() => setEdit({ type, kind })}>
            ＋ 新建{type === "categories" ? "分类" : "标签"}
          </Button>
        }
      />
      <div className={forms.toolbar}>
        <select
          aria-label="内容类型"
          value={kind}
          onChange={(e) => update({ kind: e.target.value })}
        >
          <option value="blog">技术博客</option>
          <option value="project">项目作品</option>
          <option value="life">生活记录</option>
        </select>
        <select
          aria-label="目录类型"
          value={type}
          onChange={(e) => update({ type: e.target.value })}
        >
          <option value="categories">分类</option>
          <option value="tags">标签</option>
        </select>
      </div>
      <QueryState
        loading={query.isPending}
        error={query.error}
        empty={query.data?.data.length === 0}
        emptyText="还没有目录项，可以新建一个。"
        retry={() => void query.refetch()}
      >
        <div className={table.scroll}>
          <table className={table.table}>
            <thead>
              <tr>
                <th>名称</th>
                <th>slug</th>
                {type === "categories" && <th>排序</th>}
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.data.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                  </td>
                  <td className={table.mono}>{row.slug}</td>
                  {type === "categories" && (
                    <td>{"sort_order" in row ? row.sort_order : "—"}</td>
                  )}
                  <td>
                    <div className={table.actions}>
                      <button
                        onClick={() => setEdit({ item: row, type, kind })}
                      >
                        编辑
                      </button>
                      <button
                        className={table.danger}
                        onClick={() => setRemove(row)}
                      >
                        删除
                      </button>
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
      <Dialog
        open={!!edit}
        title={edit?.item ? "编辑目录项" : "新建目录项"}
        onClose={() => setEdit(undefined)}
      >
        {edit && (
          <TaxonomyForm
            key={edit.item?.id || "new"}
            type={edit.type}
            kind={edit.kind}
            item={edit.item}
            onDone={() => setEdit(undefined)}
          />
        )}
      </Dialog>
      <ConfirmDialog
        open={!!remove}
        title="删除目录项"
        description="被任何内容引用的分类或标签无法删除，包括草稿与归档内容。"
        danger
        onClose={() => setRemove(undefined)}
        onConfirm={async () => {
          if (remove) {
            await mutations.remove.mutateAsync({
              id: remove.id,
              version: remove.version,
            });
          }
        }}
      />
    </div>
  );
}
