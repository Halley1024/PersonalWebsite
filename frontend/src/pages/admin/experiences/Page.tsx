import { useAdminProfile } from "../../../shared/queries/profile";
import { useSeo } from "../../../shared/hooks/useSeo";
import { QueryState } from "../../../shared/components/ui/query-state/QueryState";
import { PageHeading } from "../../../shared/components/ui/page-heading/PageHeading";
import { ExperienceEditor } from "./components/ExperienceEditor";
import styles from "./Page.module.css";
export default function Page() {
  const query = useAdminProfile();
  useSeo("经历与足迹");
  return <div className={styles.page}>
    {!query.data && <PageHeading eyebrow="ABOUT / TIMELINE" title="经历与足迹" description="把重要的阶段串起来，记录一路走来的探索。" />}
    <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()}>
      {query.data && <ExperienceEditor initial={query.data} />}
    </QueryState>
  </div>;
}
