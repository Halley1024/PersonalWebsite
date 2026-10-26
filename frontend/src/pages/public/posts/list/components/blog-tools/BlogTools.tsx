import { useEffect, useState, type FormEvent } from "react";
import type { TaxonomySummary } from "../../../../../../shared/api/generated";
import styles from "./BlogTools.module.css";

type Props = {
  query: string;
  tag: string;
  tags: TaxonomySummary[];
  tagsError: boolean;
  filtered: boolean;
  onSearch: (query: string) => void;
  onTag: (slug: string) => void;
  onReset: () => void;
};

export function BlogTools({
  query,
  tag,
  tags,
  tagsError,
  filtered,
  onSearch,
  onTag,
  onReset,
}: Props) {
  const [text, setText] = useState(query);
  useEffect(() => setText(query), [query]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    setText(value);
    onSearch(value);
  }
  return (
    <div className={styles.tools}>
      <form
        className={styles.toolbar}
        role="search"
        aria-label="搜索博客"
        onSubmit={submit}
      >
        <label className={styles.searchField}>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label="搜索博客"
            placeholder="搜索文章标题或摘要…"
            autoComplete="off"
            maxLength={100}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <button className={styles.controlButton} type="submit">
          搜索
        </button>
        {filtered && (
          <button
            className={styles.controlButton}
            type="button"
            onClick={() => {
              setText("");
              onReset();
            }}
          >
            清除筛选
          </button>
        )}
      </form>
      <div className={styles.tags} role="group" aria-label="按标签筛选">
        <button
          className={styles.tag}
          type="button"
          aria-pressed={!tag}
          onClick={() => onTag("")}
        >
          全部
        </button>
        {tags.map((item) => (
          <button
            className={styles.tag}
            key={item.id}
            type="button"
            aria-pressed={tag === item.slug}
            onClick={() => onTag(item.slug)}
          >
            {item.name}
          </button>
        ))}
      </div>
      {tagsError && (
        <p className={styles.error} role="status">
          标签加载失败，仍可搜索和浏览笔记。
        </p>
      )}
    </div>
  );
}
