import { useSearchParams } from "react-router-dom";

export function useUrlFilters() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
  function update(
    values: Record<string, string | number | boolean | undefined>,
    keepPage = false,
  ) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (!keepPage) next.delete("page");
      Object.entries(values).forEach(([key, value]) => {
        if (value === undefined || value === "" || value === false)
          next.delete(key);
        else next.set(key, String(value));
      });
      return next;
    });
  }
  return { params, page, update };
}
