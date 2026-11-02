import type { AdminCard } from "../../../shared/api/generated";
import { contentApi } from "../../../shared/api/content";
import { useContentMutations } from "../../../shared/queries/content";
import { ContentBindings } from "./components/ContentBindings";
import { useEffect, useRef, useState } from "react";
import type { TaxonomyType, TaxonomyRow } from "../../../shared/api/taxonomy";
import { useTaxonomyList, useTaxonomyMutations } from "../../../shared/queries/taxonomy";
import { useUrlFilters } from "../../../shared/hooks/useUrlFilters";
import { useSeo } from "../../../shared/hooks/useSeo";
import { isKind } from "../../../shared/utils/content";
import { number } from "../../../shared/utils/date";
import { PageHeading } from "../../../shared/components/ui/page-heading/PageHeading";
import { Button } from "../../../shared/components/ui/button/Button";
import { QueryState } from "../../../shared/components/ui/query-state/QueryState";
import { Pagination } from "../../../shared/components/ui/pagination/Pagination";
import { Dialog } from "../../../shared/components/ui/dialog/Dialog";
import { ConfirmDialog } from "../../../shared/components/ui/confirm-dialog/ConfirmDialog";
import { ContentLibrary, type LibraryChange } from "../../../shared/components/content/content-library/ContentLibrary";
import { TaxonomyForm } from "./components/TaxonomyForm";
import styles from "./Page.module.css";
const kinds = { blog: "技术博客", project: "项目作品", life: "生活记录" };
const resetRelated = { selected: "", content_page: "", content_q: "", content_status: "", content_sort: "" };
export default function Page() {
  const { params, page, update } = useUrlFilters();
  const candidate = params.get("kind");
  const kind = isKind(candidate) ? candidate : "blog";
  const type: TaxonomyType = params.get("type") === "tags" ? "tags" : "categories";
  const typeName = type === "categories" ? "分类" : "标签";
  const query = useTaxonomyList(type, { kind, page, page_size: 50 });
  const selected = query.data?.data.find((row) => row.id === params.get("selected"));
  const [edit, setEdit] = useState<{ item?: TaxonomyRow; type: TaxonomyType; kind: typeof kind }>();
  const [bindingEdit, setBindingEdit] = useState<AdminCard>();
  const [bindingClear, setBindingClear] = useState<AdminCard>();
  const contentMutations = useContentMutations();
  const [formBusy, setFormBusy] = useState(false);
  const [remove, setRemove] = useState<TaxonomyRow>();
  const mutations = useTaxonomyMutations(type);
  const related = useRef<HTMLElement>(null);
  const contentPage = Math.max(1, Number.parseInt(params.get("content_page") || "1", 10) || 1);
  const rawStatus = params.get("content_status") || "";
  const contentStatus = ["published", "draft", "archived"].includes(rawStatus) ? rawStatus : "";
  const rawSort = params.get("content_sort") || "updated_desc";
  const contentSort = ["updated_desc", "created_desc", "sort_asc"].includes(rawSort) ? rawSort : "updated_desc";
  const changeRelated: LibraryChange = (values, keepPage = false) => {
    const next: Record<string, string | number | undefined> = keepPage ? {} : { content_page: "" };
    for (const [key, value] of Object.entries(values)) next[`content_${key}`] = value;
    update(next, true);
  };
  const select = (row: TaxonomyRow) => update({ ...resetRelated, selected: row.id }, true);
  useEffect(() => {
    if (query.data && page > Math.max(1, query.data.meta.total_pages)) update({ page: Math.max(1, query.data.meta.total_pages), ...resetRelated }, true);
  }, [query.data, page]);
  useEffect(() => { if (selected) related.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }); }, [selected?.id]);
  useSeo("分类与标签");
  return <div className={styles.page}>
    <PageHeading eyebrow="CONTENT / TAXONOMY" title="分类与标签" description="整理博客、作品与生活的目录，查看每个分类和标签下的内容。"
      actions={<Button onClick={() => setEdit({ type, kind })}>＋ 新建{typeName}</Button>} />
    <div className={styles.kinds} role="group" aria-label="内容类型">
      {Object.entries(kinds).map(([value, label]) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => update({ kind: value, ...resetRelated })}>{label}</button>)}
    </div>
    <section className={styles.directory} aria-label="分类与标签目录">
      <div className={styles.tabs} role="group" aria-label="目录类型">
        {([['categories', '分类'], ['tags', '标签']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={type === value} onClick={() => update({ type: value, ...resetRelated })}>{label}</button>)}
        <span role="status">{query.data ? `共 ${number(query.data.meta.total)} 个${typeName}` : "正在读取目录…"}</span>
      </div>
      <p className={styles.hint}>关联数量包含已发布、草稿与归档内容，点击条目或数量查看。</p>
      <QueryState loading={query.isPending} error={query.error} empty={query.data?.data.length === 0} emptyText={`还没有${typeName}，可以点击顶部按钮新建。`} retry={() => void query.refetch()}>
        <div className={styles.scroll} role="region" aria-label={`${typeName}目录列表`} tabIndex={0}>
          <table className={styles.table}>
            <thead><tr><th scope="col">名称</th><th scope="col">slug</th>{type === "categories" && <th scope="col">排序</th>}<th scope="col">关联内容</th><th scope="col">操作</th></tr></thead>
            <tbody>{query.data?.data.map((row) => <tr key={row.id} data-selected={selected?.id === row.id || undefined} onClick={() => select(row)}>
              <td><button type="button" className={styles.name} aria-expanded={selected?.id === row.id} aria-controls="taxonomy-related-content" onClick={(event) => { event.stopPropagation(); select(row); }}>{row.name}</button></td>
              <td className={styles.slug}>{row.slug}</td>
              {type === "categories" && <td>{"sort_order" in row ? row.sort_order : "—"}</td>}
              <td><button type="button" className={styles.count} aria-label={`查看${row.name}的关联内容，共 ${row.content_count ?? "—"} 篇`} onClick={(event) => { event.stopPropagation(); select(row); }}><strong>{row.content_count === undefined ? "—" : number(row.content_count)}</strong><span>篇内容</span></button></td>
              <td><div className={styles.actions}>
                <button type="button" onClick={(event) => { event.stopPropagation(); setEdit({ item: row, type, kind }); }}>编辑</button>
                <button type="button" className={styles.danger} onClick={(event) => { event.stopPropagation(); setRemove(row); }}>删除</button>
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>
      </QueryState>
      {query.data && <div className={styles.pagination}><Pagination page={page} total={query.data.meta.total} totalPages={query.data.meta.total_pages} onChange={(page) => update({ page, ...resetRelated }, true)} /></div>}
    </section>
    {selected && <section id="taxonomy-related-content" ref={related} className={styles.related} aria-label={`${selected.name}关联内容`}>
      <header className={styles.relatedHeading}><div><h2>{selected.name}<span>{typeName}</span></h2><p>{kinds[kind]} · 共 {selected.content_count === undefined ? "—" : number(selected.content_count)} 篇关联内容</p></div><Button variant="ghost" onClick={() => update(resetRelated, true)}>收起列表</Button></header>
      <ContentLibrary key={`${kind}:${type}:${selected.id}`} filters={{ kind, ...(type === "categories" ? { category: selected.slug } : { tag: selected.slug }), page: contentPage, q: params.get("content_q") || "", status: contentStatus || undefined, sort: contentSort }} onChange={changeRelated} renderActions={(item, preview) => <>
        <button type="button" onClick={preview}>预览</button>
        <button type="button" onClick={() => setBindingEdit(item)}>修改</button>
        <button type="button" onClick={() => setBindingClear(item)}>清除</button>
      </>} />
    </section>}
    {bindingEdit && <ContentBindings item={bindingEdit} type={type} onClose={() => setBindingEdit(undefined)} />}
    <ConfirmDialog open={!!bindingClear} title={`清除文章${typeName}绑定`} description={`将“${bindingClear?.title || ""}”从“${selected?.name || ""}”中移除。`} confirmText="清除" onClose={() => setBindingClear(undefined)} onConfirm={async () => {
      if (!bindingClear || !selected) return;
      const { data } = await contentApi.adminDetail(bindingClear.id);
      const categoryIds = data.category_ids ?? (data.category_id ? [data.category_id] : []);
      await contentMutations.taxonomy.mutateAsync({ id: data.id, body: { version: data.version, category_ids: type === "categories" ? categoryIds.filter((id) => id !== selected.id) : categoryIds, tag_ids: type === "tags" ? data.tag_ids.filter((id) => id !== selected.id) : data.tag_ids } });
    }} />
    <Dialog open={!!edit} title={`${edit?.item ? "编辑" : "新建"}${edit?.type === "tags" ? "标签" : "分类"}`} onClose={() => { if (!formBusy) setEdit(undefined); }}>
      {edit && <div className={styles.form}><TaxonomyForm key={edit.item?.id || "new"} type={edit.type} kind={edit.kind} item={edit.item} onBusyChange={setFormBusy} onCancel={() => setEdit(undefined)} onDone={() => setEdit(undefined)} /></div>}
    </Dialog>
    <ConfirmDialog open={!!remove} title={`删除${typeName}`} description="被任何内容引用的分类或标签无法删除，包括草稿与归档内容。" danger onClose={() => setRemove(undefined)} onConfirm={async () => {
      if (!remove) return;
      await mutations.remove.mutateAsync({ id: remove.id, version: remove.version });
      if (selected?.id === remove.id) update(resetRelated, true);
    }} />
  </div>;
}
