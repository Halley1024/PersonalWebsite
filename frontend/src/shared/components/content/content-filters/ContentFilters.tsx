import { useEffect, useState, type FormEvent } from "react";
import type { Kind } from "../../../api/content";
import { usePublicTaxonomy } from "../../../queries/taxonomy";
import { Button } from "../../ui/button/Button";
import styles from "./ContentFilters.module.css";
export function ContentFilters({
  kind,
  values,
  onChange,
}: {
  kind: Kind;
  values: { q: string; category: string; tag: string };
  onChange: (v: Record<string, string>) => void;
}) {
  const [q, setQ] = useState(values.q);
  const categories = usePublicTaxonomy("categories", kind);
  const tags = usePublicTaxonomy("tags", kind);
  useEffect(() => setQ(values.q), [values.q]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onChange({ q: q.trim() });
  };
  return (
    <div className={styles.filters}>
      <form onSubmit={submit}>
        <input
          aria-label="搜索标题或摘要"
          placeholder="搜索笔记、想法与发现…"
          maxLength={100}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit" variant="ghost">
          搜索
        </Button>
      </form>
      <select
        aria-label="分类"
        value={values.category}
        onChange={(e) => onChange({ category: e.target.value })}
      >
        <option value="">全部分类</option>
        {categories.data?.map((item) => (
          <option key={item.id} value={item.slug}>
            {item.name}
          </option>
        ))}
      </select>
      <select
        aria-label="标签"
        value={values.tag}
        onChange={(e) => onChange({ tag: e.target.value })}
      >
        <option value="">全部标签</option>
        {tags.data?.map((item) => (
          <option key={item.id} value={item.slug}>
            {item.name}
          </option>
        ))}
      </select>
      {(values.q || values.category || values.tag) && (
        <Button
          variant="ghost"
          onClick={() => onChange({ q: "", category: "", tag: "" })}
        >
          清除
        </Button>
      )}
      {(categories.isError || tags.isError) && (
        <small role="status">分类或标签加载失败，仍可浏览内容。</small>
      )}
    </div>
  );
}
