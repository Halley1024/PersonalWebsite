import { Link, useParams } from "react-router-dom";
import { useMemo, useRef } from "react";
import { paths, type Kind } from "../../../api/content";
import { ApiError } from "../../../api/errors";
import { usePublicDetail } from "../../../queries/content";
import { usePublicProfile } from "../../../queries/profile";
import { useSeo } from "../../../hooks/useSeo";
import { usePageview } from "../../../hooks/usePageview";
import { date } from "../../../utils/date";
import { categoryNames, kindNames } from "../../../utils/content";
import { MarkdownRenderer } from "../markdown-renderer/MarkdownRenderer";
import { QueryState } from "../../ui/query-state/QueryState";
import { StatusView } from "../../feedback/status-view/StatusView";
import { ArticleNavigation } from "./ArticleNavigation";
import { ContentMetadata, ExternalLinks } from "./ContentMetadata";
import { readingMinutes } from "./reading";
import { useArticleReading } from "./useArticleReading";
import styles from "./ContentDetail.module.css";

const sections = { blog: "02 / Blog", project: "03 / Works", life: "04 / Life" };
const coverWords = { blog: "NOTES", project: "PROJECT", life: "MOMENTS" };

export function ContentDetail({ kind }: { kind: Kind }) {
  const { slug = "" } = useParams();
  const query = usePublicDetail(kind, slug);
  const profile = usePublicProfile();
  const item = query.data;
  const displayDate = item?.life?.occurred_on || item?.occurred_on || item?.published_at;
  const body = useRef<HTMLDivElement>(null);
  const reading = useArticleReading(body, item?.body_markdown || "", `${kind}/${slug}`, !!item);
  const markdown = useMemo(() => <MarkdownRenderer value={item?.body_markdown || ""} />, [item?.body_markdown]);
  const author = profile.data?.display_name || "站主";
  useSeo(item?.seo_title || item?.title || kindNames[kind], item?.seo_description || item?.excerpt);
  usePageview(query.isSuccess);
  const outline = (mobile = false) => (
    <nav className={styles.toc} aria-label={mobile ? "移动端文章目录" : "文章目录"}>
      {reading.headings.map((heading, index) => (
        <a key={heading.id} href={`#${heading.id}`} aria-current={reading.active === heading.id ? "location" : undefined}
          style={{ paddingLeft: 16 + Math.max(0, heading.level - (reading.headings[0]?.level || 1)) * 10 }}>
          <span>{String(index + 1).padStart(2, "0")}</span>{heading.title}
        </a>
      ))}
    </nav>
  );
  if (query.error instanceof ApiError && [403, 404].includes(query.error.status))
    return <StatusView forbidden={query.error.status === 403} />;
  return (
    <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()}>
      {item && (
        <div className={styles.page}>
          <div className={styles.progress} aria-hidden="true"><span ref={reading.progress} /></div>
          <nav className={styles.breadcrumb} aria-label="当前位置">
            <Link to="/">首页</Link><span>/</span><Link to={`/${paths[kind]}`}>{kindNames[kind]}</Link><span>/</span><span>正文</span>
          </nav>
          <div className={styles.layout}>
            <article className={styles.article} aria-labelledby="article-title">
              <header className={styles.header}>
                <p className={styles.label}>{sections[kind]}</p>
                <h1 id="article-title">{item.title}</h1>
                <div className={styles.meta}>
                  <span className={styles.author}><span className={styles.authorMark} aria-hidden="true">{Array.from(author)[0]}</span>{author}</span>
                  <span aria-hidden="true">/</span><time dateTime={displayDate}>{date(displayDate)}</time>
                  <span aria-hidden="true">/</span><span>约 {readingMinutes(item.body_markdown)} 分钟阅读</span>
                </div>
                {item.excerpt && <p className={styles.lead}>{item.excerpt}</p>}
              </header>
              {item.cover ? (
                <img className={styles.cover} src={item.cover.url} width={item.cover.width} height={item.cover.height} alt={item.cover.alt} />
              ) : (
                <div className={styles.coverPlaceholder} aria-hidden="true">
                  <div className={styles.coverTopline}><span>{author.toUpperCase()} / FIELD NOTES</span><span>{date(item.published_at)}</span></div>
                  <span className={styles.coverWord}>{coverWords[kind]}</span>
                  <div className={styles.coverCaption}><span>{categoryNames(item) || kindNames[kind]}</span><span>build, ship, iterate.</span></div>
                </div>
              )}
              {reading.headings.length > 0 && <details className={styles.mobileToc}><summary>本文目录</summary>{outline(true)}</details>}
              <div ref={body} className={styles.body}>{markdown}</div>
              {item.gallery.length > 0 && (
                <div className={styles.gallery}>{item.gallery.map((image) => (
                  <figure key={image.media.id}>
                    <img src={image.media.url} width={image.media.width} height={image.media.height} alt={image.alt || image.media.alt} loading="lazy" />
                    {image.alt && <figcaption>{image.alt}</figcaption>}
                  </figure>
                ))}</div>
              )}
              <div className={styles.end}><span aria-hidden="true">✦</span>感谢阅读，下一篇见。</div>
              <div className={styles.bottomBar}>
                <Link to={`/${paths[kind]}`}>← 返回{kindNames[kind]}列表</Link><a href="#article-title">回到顶部 ↑</a>
              </div>
              <ArticleNavigation kind={kind} id={item.id} />
            </article>
            <aside className={styles.sidebar} aria-label="阅读辅助">
              <div className={styles.sticky}>
                <div className={styles.desktopToc}>
                  <p className={styles.tocLabel}>ON THIS PAGE</p><h2 className={styles.sidebarTitle}>本文目录</h2>
                  {reading.headings.length ? outline() : <p className={styles.noHeadings}>正文暂无章节标题。</p>}
                </div>
                <ContentMetadata item={item} />
                <ExternalLinks links={reading.links} />
              </div>
            </aside>
          </div>
        </div>
      )}
    </QueryState>
  );
}
