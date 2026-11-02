import { usePublicContents } from "../../../../shared/queries/content";
import { useUrlFilters } from "../../../../shared/hooks/useUrlFilters";
import { usePageview } from "../../../../shared/hooks/usePageview";
import { useSeo } from "../../../../shared/hooks/useSeo";
import { ProjectCard } from "../../../../shared/components/content/project-card/ProjectCard";
import { ContentPagination } from "../../../../shared/components/ui/content-pagination/ContentPagination";
import { QueryState } from "../../../../shared/components/ui/query-state/QueryState";
import { ProjectTimeline } from "./components/ProjectTimeline";
import styles from "./Page.module.css";

export default function Page() {
  const { params, page, update } = useUrlFilters();
  const query = usePublicContents("project", {
    q: params.get("q") || "",
    category: params.get("category") || "",
    tag: params.get("tag") || "",
    page,
    page_size: 6,
    ...(params.get("featured") === "true" ? { featured: true } : {}),
  });
  const title = "把想法，变成作品。";
  const description = "从问题出发，在实践中找到答案。";
  useSeo(title, description);
  usePageview(query.isSuccess);
  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <header className={styles.heading}>
          <p className={styles.label}>03 / Works</p>
          <h1>{title}</h1>
          <p className={styles.description}>{description}</p>
        </header>
        <div className={query.data?.data.length === 0 ? styles.empty : undefined}>
          <QueryState
            loading={query.isPending}
            error={query.error}
            retry={() => void query.refetch()}
            empty={query.data?.data.length === 0}
            emptyText="这里暂时没有匹配的内容。"
          >
            <div className={styles.grid}>
              {query.data?.data.map((item) => (
                <div key={item.id} id={`project-${item.id}`} className={styles.anchor}>
                  <ProjectCard item={item} />
                </div>
              ))}
            </div>
          </QueryState>
        </div>
        {query.data && (
          <ContentPagination
            page={page}
            total={query.data.meta.total}
            totalPages={query.data.meta.total_pages}
            summary={`共 ${query.data.meta.total} 个作品 · 第 ${page} / ${Math.max(1, query.data.meta.total_pages)} 页`}
            ariaLabel="作品分页"
            onChange={(value) => update({ page: value }, true)}
          />
        )}
      </div>
      <ProjectTimeline items={query.data?.data || []} loading={query.isPending} error={query.isError} />
    </div>
  );
}
