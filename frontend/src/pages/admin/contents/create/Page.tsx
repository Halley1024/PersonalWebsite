import { useSearchParams } from "react-router-dom";
import { ContentWorkspace } from "../../../../shared/components/content/content-workspace/ContentWorkspace";
import { isKind } from "../../../../shared/utils/content";
import styles from "./Page.module.css";
export default function Page() {
  const [params] = useSearchParams();
  const value = params.get("kind");
  const kind = isKind(value) ? value : "blog";
  return (
    <div className={styles.page}>
      <ContentWorkspace key={kind} kind={kind} />
    </div>
  );
}
