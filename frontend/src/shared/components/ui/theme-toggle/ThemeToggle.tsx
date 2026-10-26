import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../../theme/useTheme";
import styles from "./ThemeToggle.module.css";
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const label = theme === "dark" ? "切换为浅色主题" : "切换为深色主题";
  return (
    <button
      className={styles.toggle}
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      {theme === "dark" ? (
        <Sun size={18} aria-hidden />
      ) : (
        <Moon size={18} aria-hidden />
      )}
    </button>
  );
}
