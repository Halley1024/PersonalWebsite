import { useId } from "react";
import type { Experience } from "../../../api/generated";
import styles from "./ExperienceTimeline.module.css";

export function ExperienceTimeline({
  items,
  variant = "default",
  embedded = false,
}: {
  items: Experience[];
  variant?: "default" | "about";
  embedded?: boolean;
}) {
  const titleId = useId();
  const about = variant === "about";
  return (
    <section
      className={`${styles.panel} ${about ? styles.about : ""} ${embedded ? styles.embedded : ""}`}
      aria-labelledby={embedded ? undefined : titleId}
      aria-label={embedded ? "经历与足迹" : undefined}
    >
      {!embedded && <><p className={styles.eyebrow}>
        {about ? "Timeline" : "TIMELINE / 经历与足迹"}
      </p>
      <h2 id={titleId}>{about ? "经历与足迹" : "一路走来的记录"}</h2></>}
      {items.length ? (
        <div
          className={about ? styles.scroll : undefined}
          role={about && !embedded ? "region" : undefined}
          aria-label={about && !embedded ? "个人经历时间线，可上下滚动" : undefined}
          tabIndex={about && !embedded ? 0 : undefined}
        >
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
        </div>
      ) : (
        <p className={styles.empty}>经历尚未公开，新的记录正在路上。</p>
      )}
    </section>
  );
}
