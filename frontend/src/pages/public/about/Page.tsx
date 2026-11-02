import { usePublicProfile } from "../../../shared/queries/profile";
import { usePageview } from "../../../shared/hooks/usePageview";
import { useSeo } from "../../../shared/hooks/useSeo";
import { QueryState } from "../../../shared/components/ui/query-state/QueryState";
import { ExperienceTimeline } from "../../../shared/components/profile/experience-timeline/ExperienceTimeline";
import { ProfileOverview } from "./components/ProfileOverview";
import styles from "./Page.module.css";
export default function AboutPage() {
  const query = usePublicProfile();
  usePageview(query.isSuccess);
  useSeo("关于", query.data?.intro);
  return (
    <>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      >
        {query.data && (
          <div className={styles.grid}>
            <ProfileOverview profile={query.data} />
            <ExperienceTimeline items={query.data.experiences} variant="about" />
          </div>
        )}
      </QueryState>
    </>
  );
}
