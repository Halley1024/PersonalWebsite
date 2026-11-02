import { categoryNames } from "../../../utils/content";
import { Link } from "react-router-dom";
import type { PublicCard } from "../../../api/generated";
import { date } from "../../../utils/date";
import styles from "./ProjectCard.module.css";

export function ProjectCard({ item, headingLevel = 2 }: { item: PublicCard; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const stack = item.tech_stack?.slice(0, 4) || [];
  return (
    <article className={styles.card}>
      <div className={styles.meta}>
        <span className={styles.badge}>{categoryNames(item) || "项目作品"}</span>
        <time dateTime={item.published_at}>{date(item.published_at)}</time>
      </div>
      <Heading className={styles.title}>{item.title}</Heading>
      <p className={styles.excerpt}>{item.excerpt}</p>
      <div className={styles.visual} aria-hidden={!item.cover || undefined}>
        {item.cover && (
          <img
            src={item.cover.url + "?variant=thumb"}
            alt={item.cover.alt}
            width={item.cover.width}
            height={item.cover.height}
            loading="lazy"
          />
        )}
      </div>
      {stack.length > 0 && (
        <div className={styles.stack} aria-label="技术栈">
          {stack.map((technology, index) => <span key={index}>{technology}</span>)}
        </div>
      )}
      <Link className={styles.link} to={`/projects/${item.slug}`} aria-label={`阅读${item.title}`} />
    </article>
  );
}
