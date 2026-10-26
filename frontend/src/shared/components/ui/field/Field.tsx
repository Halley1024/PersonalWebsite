import { cloneElement, useId, type ReactElement, type ReactNode } from "react";
import styles from "./Field.module.css";
type Child = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactElement<Child>;
}) {
  const generated = useId();
  const id = children.props.id || generated;
  const described =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, {
        id,
        "aria-invalid": !!error,
        "aria-describedby": described,
      })}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
