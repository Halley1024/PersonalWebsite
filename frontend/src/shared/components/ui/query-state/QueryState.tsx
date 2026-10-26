import type { PropsWithChildren, ReactNode } from "react";
import { LoaderCircle, Inbox } from "lucide-react";
import { Button } from "../button/Button";
import { ErrorNotice } from "../error-notice/ErrorNotice";
import styles from "./QueryState.module.css";
export function QueryState({
  loading,
  error,
  empty = false,
  emptyText = "暂时没有内容",
  retry,
  children,
  emptyAction,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyText?: string;
  retry?: () => void;
  emptyAction?: ReactNode;
} & PropsWithChildren) {
  if (loading)
    return (
      <div className={styles.state} role="status">
        <LoaderCircle className={styles.spinner} size={25} />
        <span>正在加载…</span>
      </div>
    );
  if (error)
    return (
      <div className={styles.state}>
        <ErrorNotice error={error} />
        {retry && (
          <Button variant="ghost" onClick={retry}>
            重新加载
          </Button>
        )}
      </div>
    );
  if (empty)
    return (
      <div className={styles.state}>
        <Inbox size={30} />
        <p>{emptyText}</p>
        {emptyAction}
      </div>
    );
  return <>{children}</>;
}
