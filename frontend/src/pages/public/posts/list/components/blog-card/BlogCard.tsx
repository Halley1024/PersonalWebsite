import { Link } from "react-router-dom";
import type { PublicCard } from "../../../../../../shared/api/generated";
import { date } from "../../../../../../shared/utils/date";
import styles from "./BlogCard.module.css";

export function BlogCard({ item, index }: { item: PublicCard; index: number }) {
  return (
    <article
      className={styles.card}
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty(
          "--mx",
          `${event.clientX - bounds.left}px`,
        );
        event.currentTarget.style.setProperty(
          "--my",
          `${event.clientY - bounds.top}px`,
        );
      }}
    >
      <div
        className={`${styles.thumb} ${styles[`cover${index % 6}`]}`}
        aria-hidden={!item.cover || undefined}
      >
        {item.cover && (
          <img
            src={item.cover.url}
            alt={item.cover.alt}
            width={item.cover.width}
            height={item.cover.height}
            loading="lazy"
          />
        )}
      </div>
      <div className={styles.meta}>
        <span>
          {item.tags.map((tag) => tag.name).join(" · ") ||
            item.category?.name ||
            "未分类"}
        </span>
        <time dateTime={item.published_at}>
          {date(item.published_at).replaceAll("/", "-")}
        </time>
      </div>
      <h2>{item.title}</h2>
      <p>{item.excerpt}</p>
      <span className={styles.arrow} aria-hidden="true">
        阅读 →
      </span>
      <Link
        className={styles.link}
        to={`/posts/${item.slug}`}
        aria-label={`阅读${item.title}`}
      />
    </article>
  );
}
