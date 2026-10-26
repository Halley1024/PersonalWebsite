import { ContentDetail } from "../../../../shared/components/content/content-detail/ContentDetail";
import styles from "./Page.module.css";
export default function Page() {
  return (
    <div className={styles.page}>
      <ContentDetail kind="blog" />
    </div>
  );
}
