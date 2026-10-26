import { stateNames } from "../../../utils/content";
import styles from "./Badge.module.css";
export function Badge({ value }: { value: string }) {
  return (
    <span
      className={`${styles.badge} ${["published", "active", "maintained"].includes(value) ? styles.good : ["archived", "expired", "disabled"].includes(value) ? styles.dim : ""}`}
    >
      {stateNames[value] || value}
    </span>
  );
}
