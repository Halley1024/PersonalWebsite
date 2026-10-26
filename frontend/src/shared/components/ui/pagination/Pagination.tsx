import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../button/Button";
import styles from "./Pagination.module.css";
export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (!total) return null;
  return (
    <nav className={styles.pagination} aria-label="分页">
      <span>
        共 {total} 条 · 第 {page} / {Math.max(1, totalPages)} 页
      </span>
      <div>
        <Button
          variant="ghost"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="上一页"
        >
          <ChevronLeft size={16} />
        </Button>
        <Button
          variant="ghost"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="下一页"
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </nav>
  );
}
