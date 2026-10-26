import { Link } from "react-router-dom";
import { ArrowUpRight, Code2, FileText, Camera } from "lucide-react";
import type { PublicCard } from "../../../api/generated";
import { paths } from "../../../api/content";
import { date } from "../../../utils/date";
import styles from "./ContentCard.module.css";
export function ContentCard({ item }: { item: PublicCard }) {
  const Icon =
    item.kind === "project" ? Code2 : item.kind === "life" ? Camera : FileText;
  return (
    <article className={`${styles.card} ${styles[item.kind]}`}>
      <Link
        className={styles.image}
        to={`/${paths[item.kind]}/${item.slug}`}
        aria-label={`阅读${item.title}`}
      >
        {item.cover ? (
          <img
            src={item.cover.url + "?variant=thumb"}
            alt={item.cover.alt}
            width={item.cover.width}
            height={item.cover.height}
            loading="lazy"
          />
        ) : (
          <div className={styles.placeholder}>
            <Icon size={38} strokeWidth={1} />
            <span>
              {item.kind === "project"
                ? "PROJECT / BUILD"
                : item.kind === "life"
                  ? "LIFE / MOMENTS"
                  : "NOTES / ENGINEERING"}
            </span>
          </div>
        )}
      </Link>
      <div className={styles.body}>
        <div className={styles.meta}>
          <span>
            {item.category?.name ||
              { blog: "技术笔记", project: "项目作品", life: "生活记录" }[
                item.kind
              ]}
          </span>
          <time>{date(item.occurred_on || item.published_at)}</time>
        </div>
        <h3>
          <Link to={`/${paths[item.kind]}/${item.slug}`}>
            {item.title}
            <ArrowUpRight size={17} />
          </Link>
        </h3>
        <p>{item.excerpt}</p>
        <div className={styles.tags}>
          {(item.kind === "project"
            ? item.tech_stack?.slice(0, 4).map((t) => ({ id: t, name: t }))
            : item.tags.slice(0, 4)
          )?.map((t) => (
            <span key={t.id}>{t.name}</span>
          ))}
        </div>
      </div>
    </article>
  );
}
