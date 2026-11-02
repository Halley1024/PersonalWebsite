import { Link } from "react-router-dom";
import { paths, type Kind } from "../../../api/content";
import { kindNames } from "../../../utils/content";
import { useAdjacentContents, type AdjacentContent } from "./useAdjacentContents";
import styles from "./ContentDetail.module.css";

export function ArticleNavigation({ kind, id }: { kind: Kind; id: string }) {
  const query = useAdjacentContents(kind, id);
  const step = (entry: AdjacentContent | null | undefined, previous: boolean) => {
    const className = `${styles.articleStep} ${previous ? "" : styles.next}`;
    const label = `${previous ? "← 上一篇" : "下一篇 →"} · ${kindNames[kind]}`;
    if (entry) return (
      <Link className={className} to={`/${paths[kind]}/${encodeURIComponent(entry.slug)}`} aria-label={`${label}：${entry.title}`}>
        <small>{label}</small><strong>{entry.title}</strong>
      </Link>
    );
    return (
      <div className={className} aria-disabled="true" aria-busy={query.isPending || undefined}>
        <small>{label}</small>
        <strong>{query.isPending ? "正在加载…" : query.isError ? "暂时无法加载" : `${previous ? "已是第一篇" : "已是最后一篇"}${kindNames[kind]}`}</strong>
      </div>
    );
  };
  return (
    <nav className={styles.articleNavigation} aria-label="上一篇和下一篇">
      {step(query.data?.previous, true)}
      {step(query.data?.next, false)}
      {query.isError && <div className={styles.navigationError} role="status">
        相邻内容暂时无法加载。<button type="button" onClick={() => void query.refetch()}>重新加载</button>
      </div>}
    </nav>
  );
}
