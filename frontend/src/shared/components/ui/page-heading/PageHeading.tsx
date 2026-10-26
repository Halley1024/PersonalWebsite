import type { ReactNode } from "react";
import styles from "./PageHeading.module.css";
export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.heading}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>
          {title}
          <span>.</span>
        </h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
