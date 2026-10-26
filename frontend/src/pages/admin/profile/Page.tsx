import { useAdminProfile } from "../../../shared/queries/profile";
import { useSeo } from "../../../shared/hooks/useSeo";
import { QueryState } from "../../../shared/components/ui/query-state/QueryState";
import { PageHeading } from "../../../shared/components/ui/page-heading/PageHeading";
import { ProfileEditor } from "../../../shared/components/profile/profile-editor/ProfileEditor";
import styles from "./Page.module.css";
export default function Page() {
  const query = useAdminProfile();
  useSeo("个人介绍");
  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="PROFILE / ABOUT"
        title="个人介绍"
        description="维护公开资料，让访客了解你和你的经历。"
      />
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      >
        {query.data && (
          <ProfileEditor initial={query.data} experiences={false} />
        )}
      </QueryState>
    </div>
  );
}
