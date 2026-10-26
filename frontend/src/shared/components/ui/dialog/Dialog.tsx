import {
  useEffect,
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
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  wide?: boolean;
} & PropsWithChildren) {
  const ref = useRef<HTMLDialogElement>(null);
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
      className={`${styles.dialog} ${wide ? styles.wide : ""}`}
      aria-label={title}
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
        <h2>{title}</h2>
        <button onClick={onClose} aria-label="关闭弹窗">
          <X size={20} />
        </button>
      </header>
      <div className={styles.body}>{open && children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </dialog>
  );
}
