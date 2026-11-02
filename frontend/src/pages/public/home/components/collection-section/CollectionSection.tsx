import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Page } from "../../../../../shared/api/client";
import type { PublicCard } from "../../../../../shared/api/generated";
import { BlogCard } from "../../../../../shared/components/content/blog-card/BlogCard";
import { ProjectCard } from "../../../../../shared/components/content/project-card/ProjectCard";
import { LifeCard } from "../../../../../shared/components/content/life-card/LifeCard";
import { QueryState } from "../../../../../shared/components/ui/query-state/QueryState";
import styles from "./CollectionSection.module.css";
export function CollectionSection({
  index,
  title,
  subtitle,
  to,
  query,
}: {
  index: string;
  title: string;
  subtitle: string;
  to: string;
  query: UseQueryResult<Page<PublicCard>, Error>;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.heading}>
        <div>
          <p>{index}</p>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>
        <Link to={to}>
          查看全部
          <ArrowUpRight size={15} />
        </Link>
      </div>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        empty={!query.data?.data.length}
        emptyText="还没有已发布的内容，敬请期待。"
      >
        <div className={styles.grid}>
          {query.data?.data.map((item, index) => {
            if (item.kind === "blog") return <BlogCard key={item.id} item={item} index={index} headingLevel={3} />;
            if (item.kind === "project") return <ProjectCard key={item.id} item={item} headingLevel={3} />;
            return <LifeCard key={item.id} item={item} index={index} headingLevel={3} />;
          })}
        </div>
      </QueryState>
    </section>
  );
}
