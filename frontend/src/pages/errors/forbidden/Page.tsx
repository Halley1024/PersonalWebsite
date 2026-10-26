import { StatusView } from "../../../shared/components/feedback/status-view/StatusView";
import styles from "./Page.module.css";
export default function Page() {
  return (
    <div className={styles.page}>
      <StatusView forbidden={true} />
    </div>
  );
}
