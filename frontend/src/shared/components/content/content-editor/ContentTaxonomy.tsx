import { useState } from "react";
import { Check } from "lucide-react";
import type { Kind } from "../../../api/content";
import type { TaxonomyType } from "../../../api/taxonomy";
import { useTaxonomyOptions } from "../../../queries/taxonomy";
import { Dialog } from "../../ui/dialog/Dialog";
import { Button } from "../../ui/button/Button";
import { QueryState } from "../../ui/query-state/QueryState";
import { TaxonomyForm } from "../../taxonomy/taxonomy-form/TaxonomyForm";
import styles from "./ContentTaxonomy.module.css";
export function ContentTaxonomy({ kind, categoryIds, tagIds, onChange }: {
  kind: Kind; categoryIds: string[]; tagIds: string[]; onChange: (value: { category_id: string | null; category_ids: string[]; tag_ids: string[] }) => void;
}) {
  const categories = useTaxonomyOptions("categories", kind);
  const tags = useTaxonomyOptions("tags", kind);
  const [creating, setCreating] = useState<TaxonomyType>();
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<{ category_id: string | null; category_ids: string[]; tag_ids: string[] }>) => onChange({ category_ids: categoryIds, category_id: (patch.category_ids ?? categoryIds)[0] ?? null, tag_ids: tagIds, ...patch });
  return <div className={styles.stack}>
    <section><div className={styles.heading}><h3>分类</h3><Button variant="ghost" onClick={() => setCreating("categories")}>＋ 新增分类</Button></div>
      <QueryState loading={categories.isPending} error={categories.error} retry={() => void categories.refetch()}>
        <div className={styles.options} role="group" aria-label="选择分类">
          {categories.data?.map((category) => <button type="button" key={category.id} aria-pressed={categoryIds.includes(category.id)} onClick={() => set({ category_ids: categoryIds.includes(category.id) ? categoryIds.filter((id) => id !== category.id) : [...categoryIds, category.id] })}><span className={styles.selectionMark} aria-hidden="true">{categoryIds.includes(category.id) && <Check size={12} />}</span>{category.name}</button>)}
        </div>
        <p className={styles.hint}>{categories.data?.length ? "分类可多选，点击选择，再次点击可取消。" : "暂无分类，可点击“新增分类”创建。"}</p>
      </QueryState>
    </section>
    <section><div className={styles.heading}><h3>标签 <small>{tagIds.length} / 10</small></h3><Button variant="ghost" onClick={() => setCreating("tags")}>＋ 新增标签</Button></div>
      <QueryState loading={tags.isPending} error={tags.error} empty={tags.data?.length === 0} emptyText="暂无标签，可点击“新增标签”创建。" retry={() => void tags.refetch()}>
        <div className={styles.options} role="group" aria-label="选择标签">{tags.data?.map((tag) => <button type="button" key={tag.id} aria-pressed={tagIds.includes(tag.id)} disabled={!tagIds.includes(tag.id) && tagIds.length >= 10}
          onClick={() => set({ tag_ids: tagIds.includes(tag.id) ? tagIds.filter((id) => id !== tag.id) : [...tagIds, tag.id] })}><span className={styles.selectionMark} aria-hidden="true">{tagIds.includes(tag.id) && <Check size={12} />}</span>{tag.name}</button>)}</div>
      </QueryState>
      <p className={styles.hint}>点击可选择或取消标签，最多选择 10 个。</p>
    </section>
    <Dialog open={!!creating} title={creating === "categories" ? "新增分类" : "新增标签"} onClose={() => { if (!saving) setCreating(undefined); }}>
      {creating && <div className={styles.dialog}><TaxonomyForm type={creating} kind={kind} onBusyChange={setSaving} onCancel={() => setCreating(undefined)} onDone={(item) => {
        if (item) {
          if (creating === "categories") set({ category_ids: [...categoryIds, item.id] });
          else if (tagIds.length < 10 && !tagIds.includes(item.id)) set({ tag_ids: [...tagIds, item.id] });
        }
        setCreating(undefined);
      }} /></div>}
    </Dialog>
  </div>;
}
