import { ContentList } from "../../../../shared/components/content/content-list/ContentList";
import styles from "./Page.module.css";
export default function Page() {
  return (
    <div className={styles.page}>
      <ContentList kind="project" />
    </div>
  );
}
