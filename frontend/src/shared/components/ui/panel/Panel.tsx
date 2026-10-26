import type { PropsWithChildren, ReactNode } from "react";
import styles from "./Panel.module.css";
export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
}: PropsWithChildren<{
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}>) {
  return (
    <section className={`${styles.panel} ${className}`}>
      {(title || actions) && (
        <div className={styles.heading}>
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
