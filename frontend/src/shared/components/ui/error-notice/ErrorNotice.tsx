import { AlertCircle } from "lucide-react";
import { ApiError, errorMessage } from "../../../api/errors";
import styles from "./ErrorNotice.module.css";
export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className={styles.notice} role="alert">
      <AlertCircle size={18} />
      <div>
        <p>{errorMessage(error)}</p>
        {error instanceof ApiError &&
          Object.entries(error.fields).length > 0 && (
            <ul>
              {Object.entries(error.fields).map(([field, message]) => (
                <li key={field}>
                  {field}：{message}
                </li>
              ))}
            </ul>
          )}
        {error instanceof ApiError && error.requestId && (
          <small>请求 ID：{error.requestId}</small>
        )}
      </div>
    </div>
  );
}
