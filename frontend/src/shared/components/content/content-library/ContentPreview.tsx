import { useAdminDetail } from "../../../queries/content";
import { Dialog } from "../../ui/dialog/Dialog";
import { QueryState } from "../../ui/query-state/QueryState";
import { Badge } from "../../ui/badge/Badge";
import { MarkdownRenderer } from "../../content/markdown-renderer/MarkdownRenderer";
import { kindNames } from "../../../utils/content";
import { date } from "../../../utils/date";
import styles from "./ContentLibrary.module.css";
export function ContentPreview({ id, onClose }: { id: string; onClose: () => void }) {
  const query = useAdminDetail(id);
  const item = query.data;
  return <Dialog open title="内容预览" onClose={onClose} wide>
    <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()}>
      {item && <article className={styles.preview}>
        {item.cover && <img className={styles.previewCover} src={item.cover.url} alt={item.cover.alt || ""} />}
        <div className={styles.previewMeta}><span>{kindNames[item.kind]}</span><Badge value={item.status} /><span>{date(item.updated_at)}</span></div>
        <h2>{item.title}</h2><p className={styles.previewExcerpt}>{item.excerpt}</p>
        {item.kind === "project" && item.project && <p className={styles.previewInfo}>项目周期：{item.project.started_on} — {item.project.ended_on || "至今"}</p>}
        {item.kind === "life" && item.life && <p className={styles.previewInfo}>发生时间：{item.life.occurred_on}{item.life.location_label && ` · ${item.life.location_label}`}</p>}
        {item.tags.length > 0 && <div className={styles.previewTags}>{item.tags.map((tag) => <span key={tag.id}>#{tag.name}</span>)}</div>}
        <MarkdownRenderer value={item.body_markdown || "暂无正文"} />
      </article>}
    </QueryState>
  </Dialog>;
}
