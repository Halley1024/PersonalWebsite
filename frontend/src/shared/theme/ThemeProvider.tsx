import { useEffect, useState, type PropsWithChildren } from "react";
import { ThemeContext, type Theme } from "./context";
export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem("halley.theme", theme);
    } catch {
      /* Theme still works without storage. */
    }
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (meta)
      meta.content = getComputedStyle(document.documentElement)
        .getPropertyValue("--bg")
        .trim();
  }, [theme]);
  function changeTheme(next: Theme) {
    // Update the palette before children redraw canvas effects.
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    setTheme(next);
  }
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === "halley.theme" || event.key === null)
        changeTheme(event.newValue === "light" ? "light" : "dark");
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggle: () => changeTheme(theme === "dark" ? "light" : "dark"),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
