import { useAdminProfile } from "../../../shared/queries/profile";
import { useSeo } from "../../../shared/hooks/useSeo";
import { QueryState } from "../../../shared/components/ui/query-state/QueryState";
import { PageHeading } from "../../../shared/components/ui/page-heading/PageHeading";
import { ProfileEditor } from "../../../shared/components/profile/profile-editor/ProfileEditor";
import styles from "./Page.module.css";
export default function Page() {
  const query = useAdminProfile();
  useSeo("经历与足迹");
  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="PROFILE / TIMELINE"
        title="经历与足迹"
        description="维护公开资料，让访客了解你和你的经历。"
      />
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      >
        {query.data && (
          <ProfileEditor initial={query.data} experiences={true} />
        )}
      </QueryState>
    </div>
  );
}
