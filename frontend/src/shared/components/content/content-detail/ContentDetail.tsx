import { Link, useParams } from "react-router-dom";
import { useMemo } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { paths, type Kind } from "../../../api/content";
import { ApiError } from "../../../api/errors";
import { usePublicDetail } from "../../../queries/content";
import { useSeo } from "../../../hooks/useSeo";
import { usePageview } from "../../../hooks/usePageview";
import { date } from "../../../utils/date";
import { kindNames, stateNames } from "../../../utils/content";
import { safeLink } from "../../../utils/url";
import { toc } from "../markdown-renderer/markdown";
import { MarkdownRenderer } from "../markdown-renderer/MarkdownRenderer";
import { QueryState } from "../../ui/query-state/QueryState";
import { StatusView } from "../../feedback/status-view/StatusView";
import styles from "./ContentDetail.module.css";
export function ContentDetail({ kind }: { kind: Kind }) {
  const { slug = "" } = useParams();
  const query = usePublicDetail(kind, slug);
  const item = query.data;
  useSeo(
    item?.seo_title || item?.title || kindNames[kind],
    item?.seo_description || item?.excerpt,
  );
  usePageview(query.isSuccess);
  const headings = useMemo(
    () => toc(item?.body_markdown || ""),
    [item?.body_markdown],
  );
  if (
    query.error instanceof ApiError &&
    [403, 404].includes(query.error.status)
  )
    return <StatusView forbidden={query.error.status === 403} />;
  return (
    <QueryState
      loading={query.isPending}
      error={query.error}
      retry={() => void query.refetch()}
    >
      {item && (
        <article className={styles.article}>
          <Link to={`/${paths[kind]}`} className={styles.back}>
            <ArrowLeft size={15} />
            返回{kindNames[kind]}
          </Link>
          <header className={styles.header}>
            <div className={styles.meta}>
              {item.category?.name || kindNames[kind]} <span>/</span>{" "}
              <time>{date(item.occurred_on || item.published_at)}</time>
            </div>
            <h1>{item.title}</h1>
            <p>{item.excerpt}</p>
            <div className={styles.tags}>
              {item.tags.map((tag) => (
                <Link key={tag.id} to={`/${paths[kind]}?tag=${tag.slug}`}>
                  # {tag.name}
                </Link>
              ))}
            </div>
          </header>
          {item.cover && (
            <img
              className={styles.cover}
              src={item.cover.url}
              width={item.cover.width}
              height={item.cover.height}
              alt={item.cover.alt}
            />
          )}
          {item.project && (
            <div className={styles.project}>
              <span>{stateNames[item.project.project_stage]}</span>
              <span>
                {item.project.started_on} — {item.project.ended_on || "至今"}
              </span>
              {item.project.tech_stack.map((t) => (
                <span key={t}>{t}</span>
              ))}
              {[
                ["源码", item.project.repository_url],
                ["在线演示", item.project.demo_url],
              ].map(([label, url]) =>
                url && safeLink(url) ? (
                  <a
                    key={label}
                    href={safeLink(url)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {label}
                    <ArrowUpRight size={14} />
                  </a>
                ) : null,
              )}
            </div>
          )}
          {item.life?.location_label && (
            <p className={styles.location}>
              {item.life.occurred_on} · {item.life.location_label}
            </p>
          )}
          <div className={styles.reading}>
            <MarkdownRenderer value={item.body_markdown} />
            {headings.length > 0 && (
              <aside className={styles.toc}>
                <strong>本页目录</strong>
                {headings.map((h) => (
                  <a
                    href={`#${h.id}`}
                    key={h.id}
                    style={{ paddingLeft: (h.level - 1) * 10 }}
                  >
                    {h.title}
                  </a>
                ))}
              </aside>
            )}
          </div>
          {item.gallery.length > 0 && (
            <div className={styles.gallery}>
              {item.gallery.map((image) => (
                <figure key={image.media.id}>
                  <img
                    src={image.media.url}
                    width={image.media.width}
                    height={image.media.height}
                    alt={image.alt || image.media.alt}
                    loading="lazy"
                  />
                  {image.alt && <figcaption>{image.alt}</figcaption>}
                </figure>
              ))}
            </div>
          )}
          <footer className={styles.footer}>
            更新于 {date(item.updated_at)}{" "}
            <Link to={`/${paths[kind]}`}>继续阅读 →</Link>
          </footer>
        </article>
      )}
    </QueryState>
  );
}
