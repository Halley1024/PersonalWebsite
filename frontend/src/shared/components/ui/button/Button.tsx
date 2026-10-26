import type { ButtonHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import styles from "./Button.module.css";
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  loading?: boolean;
};
export function Button({
  variant = "primary",
  loading,
  disabled,
  children,
  className = "",
  type = "button",
  ...props
}: Props) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${styles.button} ${styles[variant]} ${className}`}
    >
      {loading && (
        <LoaderCircle size={15} className={styles.spinner} aria-hidden />
      )}
      {children}
    </button>
  );
}
export function ButtonLink({ className = "", ...props }: LinkProps) {
  return (
    <Link
      {...props}
      className={`${styles.button} ${styles.ghost} ${className}`}
    />
  );
}
