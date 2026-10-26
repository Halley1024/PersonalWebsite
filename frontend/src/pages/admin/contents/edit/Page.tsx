import { useParams } from "react-router-dom";
import { useAdminDetail } from "../../../../shared/queries/content";
import { ContentWorkspace } from "../../../../shared/components/content/content-workspace/ContentWorkspace";
import { QueryState } from "../../../../shared/components/ui/query-state/QueryState";
import styles from "./Page.module.css";
export default function Page() {
  const { id } = useParams();
  const query = useAdminDetail(id);
  return (
    <div className={styles.page}>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      >
        {query.data && (
          <ContentWorkspace
            key={query.data.id}
            item={query.data}
            kind={query.data.kind}
            reload={query.refetch}
          />
        )}
      </QueryState>
    </div>
  );
}
