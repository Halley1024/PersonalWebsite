import { categoryNames } from "../../../utils/content";
import { Link } from "react-router-dom";
import type { PublicCard } from "../../../api/generated";
import { date } from "../../../utils/date";
import styles from "./LifeCard.module.css";

export function LifeCard({ item, index, headingLevel = 2 }: { item: PublicCard; index: number; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <article className={`${styles.card} ${styles[`cover${index % 5}`]}`}>
      {item.cover && (
        <img className={styles.photo} src={item.cover.url + "?variant=thumb"}
          alt={item.cover.alt} width={item.cover.width} height={item.cover.height} loading="lazy" />
      )}
      <div className={styles.caption}>
        <Heading className={styles.title}>{item.title}</Heading>
        <div className={styles.meta}>
          <span>{categoryNames(item) || "生活记录"}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={item.occurred_on || item.published_at}>{date(item.occurred_on || item.published_at)}</time>
        </div>
        {item.tags.length > 0 && <p className={styles.tags}>{item.tags.map((tag) => `#${tag.name}`).join("  ")}</p>}
        {item.excerpt && (
          <div className={styles.reveal}>
            <div className={styles.revealInner}><p className={styles.excerpt}>{item.excerpt}</p></div>
          </div>
        )}
      </div>
      <Link className={styles.link} to={`/life/${item.slug}`} aria-label={`阅读${item.title}`} />
    </article>
  );
}
