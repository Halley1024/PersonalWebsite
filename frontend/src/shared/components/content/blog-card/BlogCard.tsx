import { categoryNames } from "../../../utils/content";
import { Link } from "react-router-dom";
import type { PublicCard } from "../../../api/generated";
import { date } from "../../../utils/date";
import styles from "./BlogCard.module.css";

export function BlogCard({ item, index, headingLevel = 2 }: { item: PublicCard; index: number; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
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
            categoryNames(item) ||
            "未分类"}
        </span>
        <time dateTime={item.published_at}>
          {date(item.published_at).replaceAll("/", "-")}
        </time>
      </div>
      <Heading className={styles.title}>{item.title}</Heading>
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
