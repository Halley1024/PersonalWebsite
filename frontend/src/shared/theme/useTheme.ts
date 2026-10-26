import { useContext } from "react";
import { ThemeContext } from "./context";
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("ThemeProvider 未挂载");
  return value;
}
