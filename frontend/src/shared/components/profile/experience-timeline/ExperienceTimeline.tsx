import type { Experience } from "../../../api/generated";
import styles from "./ExperienceTimeline.module.css";
export function ExperienceTimeline({ items }: { items: Experience[] }) {
  return (
    <section className={styles.panel}>
      <p className={styles.eyebrow}>TIMELINE / 经历与足迹</p>
      <h2>一路走来的记录</h2>
      {items.length ? (
        <div className={styles.list}>
          {items.map((item) => (
            <article key={item.id} className={styles.item}>
              <time>
                {item.start_date} — {item.end_date || "至今"}
              </time>
              <h3>{item.title}</h3>
              {item.organization && (
                <p className={styles.organization}>{item.organization}</p>
              )}
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.empty}>经历尚未公开，新的记录正在路上。</p>
      )}
    </section>
  );
}
