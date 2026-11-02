import {
  useEffect,
  useId,
  useRef,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import styles from "./Dialog.module.css";
export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  wide = false,
  variant = "default",
  eyebrow,
  description,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  wide?: boolean;
  variant?: "default" | "contact";
  eyebrow?: string;
  description?: string;
} & PropsWithChildren) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${wide ? styles.wide : ""} ${variant === "contact" ? styles.contact : ""}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const rect = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <header className={styles.heading}>
        {variant === "contact" ? (
          <div>
            {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId} className={styles.description}>{description}</p>}
          </div>
        ) : <h2 id={titleId}>{title}</h2>}
        <button type="button" onClick={onClose} aria-label={variant === "contact" ? "关闭联系弹窗" : "关闭弹窗"}>
          <X size={20} />
        </button>
      </header>
      <div className={styles.body}>{open && children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </dialog>
  );
}
