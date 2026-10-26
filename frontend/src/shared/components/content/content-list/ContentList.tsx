import type { Kind } from "../../../api/content";
import { usePublicContents } from "../../../queries/content";
import { useUrlFilters } from "../../../hooks/useUrlFilters";
import { usePageview } from "../../../hooks/usePageview";
import { useSeo } from "../../../hooks/useSeo";
import { ContentCard } from "../content-card/ContentCard";
import { ContentFilters } from "../content-filters/ContentFilters";
import { PageHeading } from "../../ui/page-heading/PageHeading";
import { Pagination } from "../../ui/pagination/Pagination";
import { QueryState } from "../../ui/query-state/QueryState";
import styles from "./ContentList.module.css";
const labels = {
  blog: [
    "NOTES / THOUGHTS & ENGINEERING",
    "思考与技术笔记",
    "把问题拆开，把经验留下。",
  ],
  project: [
    "PROJECTS / IDEAS INTO REALITY",
    "把想法，变成作品。",
    "从问题出发，在实践中找到答案。",
  ],
  life: [
    "LIFE / MOMENTS IN BETWEEN",
    "代码之外的生活",
    "在构建与探索之间，记录那些平凡而珍贵的时刻。",
  ],
};
export function ContentList({ kind }: { kind: Kind }) {
  const { params, page, update } = useUrlFilters();
  const values = {
    q: params.get("q") || "",
    category: params.get("category") || "",
    tag: params.get("tag") || "",
  };
  const query = usePublicContents(kind, {
    ...values,
    page,
    page_size: kind === "project" ? 9 : kind === "blog" ? 6 : 12,
    ...(params.get("featured") === "true" ? { featured: true } : {}),
  });
  const [eyebrow, title, description] = labels[kind];
  useSeo(title, description);
  usePageview(query.isSuccess);
  return (
    <>
      <PageHeading eyebrow={eyebrow} title={title} description={description} />
      <ContentFilters kind={kind} values={values} onChange={update} />
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        empty={query.data?.data.length === 0}
        emptyText="这里暂时没有匹配的内容。"
      >
        <div className={styles.grid}>
          {query.data?.data.map((item) => (
            <ContentCard item={item} key={item.id} />
          ))}
        </div>
      </QueryState>
      {query.data && (
        <Pagination
          page={page}
          total={query.data.meta.total}
          totalPages={query.data.meta.total_pages}
          onChange={(p) => update({ page: p }, true)}
        />
      )}
    </>
  );
}
