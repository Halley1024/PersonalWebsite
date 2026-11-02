import { usePublicContents } from "../../../../shared/queries/content";
import { usePublicTaxonomy } from "../../../../shared/queries/taxonomy";
import { useUrlFilters } from "../../../../shared/hooks/useUrlFilters";
import { usePageview } from "../../../../shared/hooks/usePageview";
import { useSeo } from "../../../../shared/hooks/useSeo";
import { QueryState } from "../../../../shared/components/ui/query-state/QueryState";
import { BlogPagination } from "./components/BlogPagination";
import { BlogCard } from "../../../../shared/components/content/blog-card/BlogCard";
import { BlogTools } from "./components/blog-tools/BlogTools";
import styles from "./Page.module.css";

export default function Page() {
  const { params, page, update } = useUrlFilters();
  const q = params.get("q") || "";
  const tag = params.get("tag") || "";
  const category = params.get("category") || "";
  const query = usePublicContents("blog", {
    q,
    tag,
    category,
    page,
    page_size: 6,
  });
  const tags = usePublicTaxonomy("tags", "blog");
  const description =
    "记录踩坑、复现与思考，主要集中在模型工程化与机器人中间件两个方向。";
  useSeo("总结经验，分享心得", description);
  usePageview(query.isSuccess);
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <p className={styles.label}>02 / Blog</p>
        <h1>
          总结经验，分享心得<span className={styles.titleAccent}>.</span>
        </h1>
        <p className={styles.description}>{description}</p>
      </header>
      <BlogTools
        query={q}
        tag={tag}
        tags={tags.data || []}
        tagsError={tags.isError}
        filtered={!!(q || tag || category)}
        onSearch={(value) => update({ q: value })}
        onTag={(value) => update({ tag: value })}
        onReset={() => update({ q: "", tag: "", category: "" })}
      />
      {query.data && (
        <p className={styles.results} role="status" aria-live="polite">
          共 {query.data.meta.total} 篇笔记{q ? ` · 搜索“${q}”` : ""}
          {tag
            ? ` · ${tags.data?.find((item) => item.slug === tag)?.name || tag}`
            : ""}
        </p>
      )}
      <div className={query.data?.data.length === 0 ? styles.empty : undefined}>
        <QueryState
          loading={query.isPending}
          error={query.error}
          retry={() => void query.refetch()}
          empty={query.data?.data.length === 0}
          emptyText="没有找到匹配的笔记，试试其他关键词或清除筛选。"
        >
          <div className={styles.grid}>
            {query.data?.data.map((item, index) => (
              <BlogCard key={item.id} item={item} index={index} />
            ))}
          </div>
        </QueryState>
      </div>
      {query.data && (
        <BlogPagination
          page={page}
          total={query.data.meta.total}
          totalPages={query.data.meta.total_pages}
          onChange={(value) => update({ page: value }, true)}
        />
      )}
    </div>
  );
}
