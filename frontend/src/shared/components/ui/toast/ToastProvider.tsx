import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
} from "react";
import { CheckCircle2, X } from "lucide-react";
import styles from "./Toast.module.css";
const Context = createContext<(message: string) => void>(() => {});
export function ToastProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<{ id: string; text: string }[]>([]);
  const notify = (text: string) => {
    const id = crypto.randomUUID();
    setItems((v) => [...v.slice(-3), { id, text }]);
    window.setTimeout(
      () => setItems((v) => v.filter((t) => t.id !== id)),
      4500,
    );
  };
  return (
    <Context.Provider value={notify}>
      {children}
      <div className={styles.stack} aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={styles.toast}>
            <CheckCircle2 size={18} />
            <span>{item.text}</span>
            <button
              aria-label="关闭提示"
              onClick={() => setItems((v) => v.filter((t) => t.id !== item.id))}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </Context.Provider>
  );
}
export const useToast = () => useContext(Context);
