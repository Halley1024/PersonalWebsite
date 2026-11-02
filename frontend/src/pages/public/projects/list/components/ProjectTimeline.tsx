import type { PublicCard } from "../../../../../shared/api/generated";
import { date } from "../../../../../shared/utils/date";
import styles from "./ProjectTimeline.module.css";

const stages: Record<string, string> = {
  idea: "构思中",
  building: "开发中",
  maintained: "维护中",
  completed: "已完成",
};

export function ProjectTimeline({ items, loading, error }: {
  items: PublicCard[];
  loading: boolean;
  error: boolean;
}) {
  const sorted = [...items].sort((a, b) =>
    (b.started_on || b.published_at).localeCompare(a.started_on || a.published_at),
  );
  return (
    <aside className={styles.timeline} aria-labelledby="project-timeline-title">
      <p className={styles.label}>Project Log</p>
      <h2 id="project-timeline-title">作品时间线</h2>
      {items.length ? (
        <div className={styles.scroll} role="region" aria-label="作品时间线，可上下滚动" tabIndex={0}>
          <ol className={styles.list}>
            {sorted.map((item) => (
              <li key={item.id}>
                <div className={styles.date}>
                  <time dateTime={item.started_on || item.published_at}>{date(item.started_on || item.published_at)}</time>
                  {item.project_stage && stages[item.project_stage] && ` · ${stages[item.project_stage]}`}
                </div>
                <a href={`#project-${item.id}`}>{item.title} ↗</a>
                <p className={styles.description}>{item.excerpt}</p>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className={styles.empty}>{loading ? "正在加载…" : error ? "作品时间线暂时无法加载。" : "暂无已公开的作品。"}</p>
      )}
    </aside>
  );
}
