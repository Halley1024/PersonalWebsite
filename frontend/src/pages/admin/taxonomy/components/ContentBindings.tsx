import { useState } from "react";
import { Check } from "lucide-react";
import type { AdminCard, AdminDetail } from "../../../../shared/api/generated";
import type { TaxonomyType } from "../../../../shared/api/taxonomy";
import { useAdminDetail, useContentMutations } from "../../../../shared/queries/content";
import { useTaxonomyOptions } from "../../../../shared/queries/taxonomy";
import { Dialog } from "../../../../shared/components/ui/dialog/Dialog";
import { QueryState } from "../../../../shared/components/ui/query-state/QueryState";
import { Button } from "../../../../shared/components/ui/button/Button";
import { ErrorNotice } from "../../../../shared/components/ui/error-notice/ErrorNotice";
import optionsStyle from "../../../../shared/components/content/content-editor/ContentTaxonomy.module.css";
import styles from "../Page.module.css";
export function ContentBindings({ item, type, onClose }: { item: AdminCard; type: TaxonomyType; onClose: () => void }) {
  const query = useAdminDetail(item.id);
  const [busy, setBusy] = useState(false);
  return <Dialog open title={`修改文章${type === "categories" ? "分类" : "标签"}`} onClose={() => { if (!busy) onClose(); }}>
    <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()}>
      {query.data && <BindingForm key={`${query.data.id}:${query.data.version}`} item={query.data} type={type} onClose={onClose} onBusy={setBusy} />}
    </QueryState>
  </Dialog>;
}
function BindingForm({ item, type, onClose, onBusy }: { item: AdminDetail; type: TaxonomyType; onClose: () => void; onBusy: (busy: boolean) => void }) {
  const categories = item.category_ids ?? (item.category_id ? [item.category_id] : []);
  const [selected, setSelected] = useState(type === "categories" ? categories : item.tag_ids);
  const [error, setError] = useState<unknown>();
  const options = useTaxonomyOptions(type, item.kind);
  const mutation = useContentMutations().taxonomy;
  const name = type === "categories" ? "分类" : "标签";
  async function save() {
    onBusy(true); setError(undefined);
    try {
      await mutation.mutateAsync({ id: item.id, body: { version: item.version, category_ids: type === "categories" ? selected : categories, tag_ids: type === "tags" ? selected : item.tag_ids } });
      onClose();
    } catch (error) { setError(error); } finally { onBusy(false); }
  }
  return <div className={styles.bindingForm}>
    <p>{item.title}</p><p>选择这篇文章的{name}，再次点击可取消。</p>
    <QueryState loading={options.isPending} error={options.error} empty={options.data?.length === 0} emptyText={`暂无可用${name}`} retry={() => void options.refetch()}>
      <fieldset disabled={mutation.isPending} className={optionsStyle.options} aria-label={`修改文章${name}`}>
        {options.data?.map((option) => <button type="button" key={option.id} role="checkbox" aria-checked={selected.includes(option.id)} aria-pressed={selected.includes(option.id)} disabled={type === "tags" && !selected.includes(option.id) && selected.length >= 10}
          onClick={() => setSelected(selected.includes(option.id) ? selected.filter((id) => id !== option.id) : [...selected, option.id])}><span className={optionsStyle.selectionMark} aria-hidden="true">{selected.includes(option.id) && <Check size={12} />}</span>{option.name}</button>)}
      </fieldset>
    </QueryState>
    <ErrorNotice error={error} />
    <div className={styles.bindingActions}><Button variant="ghost" disabled={mutation.isPending} onClick={onClose}>取消</Button><Button loading={mutation.isPending} disabled={options.isPending || !!options.error} onClick={() => void save()}>保存修改</Button></div>
  </div>;
}
