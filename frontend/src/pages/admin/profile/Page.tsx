import type { ReactNode } from "react";
import { useAdminProfile } from "../../../shared/queries/profile";
import { useSeo } from "../../../shared/hooks/useSeo";
import { QueryState } from "../../../shared/components/ui/query-state/QueryState";
import { PageHeading } from "../../../shared/components/ui/page-heading/PageHeading";
import { ProfileEditor } from "../../../shared/components/profile/profile-editor/ProfileEditor";
import { ProfilePreview } from "./components/ProfilePreview";
import styles from "./Page.module.css";
export default function Page() {
  const query = useAdminProfile();
  useSeo("个人介绍");
  const heading = (actions?: ReactNode) => <PageHeading eyebrow="ABOUT / PROFILE" title="个人介绍" description="介绍你是谁，以及你持续投入的事情。" actions={actions} />;
  return <div className={styles.page}>
    {!query.data && heading()}
    <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()}>
      {query.data && <ProfileEditor initial={query.data} renderHeading={heading}
        renderPreview={(value, dirty) => <ProfilePreview value={value} initial={query.data!} dirty={dirty} />} />}
    </QueryState>
  </div>;
}
