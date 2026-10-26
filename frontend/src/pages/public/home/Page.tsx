import { useHomePage } from "./hooks/useHomePage";
import { HeroSection } from "./components/hero-section/HeroSection";
import { CollectionSection } from "./components/collection-section/CollectionSection";
import { QueryState } from "../../../shared/components/ui/query-state/QueryState";
import styles from "./Page.module.css";
export default function HomePage() {
  const page = useHomePage();
  return (
    <div className={styles.page}>
      <QueryState
        loading={page.profile.isPending}
        error={page.profile.error}
        retry={() => void page.profile.refetch()}
      >
        {page.profile.data && <HeroSection profile={page.profile.data} />}
      </QueryState>
      <CollectionSection
        index="01 / SELECTED PROJECTS"
        title="把想法，变成作品。"
        subtitle="从问题出发，在实践中找到答案。"
        to="/projects"
        query={page.projects}
      />
      <CollectionSection
        index="02 / LATEST NOTES"
        title="思考与技术笔记"
        subtitle="记录过程，也分享那些值得留下的发现。"
        to="/posts"
        query={page.posts}
      />
      <CollectionSection
        index="03 / LIFE IN BETWEEN"
        title="代码之外的生活"
        subtitle="在构建与探索之间，留一点时间给日常。"
        to="/life"
        query={page.life}
      />
    </div>
  );
}
