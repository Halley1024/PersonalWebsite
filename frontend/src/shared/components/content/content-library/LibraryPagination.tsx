import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Page } from "../../../api/client";
import { number } from "../../../utils/date";
import styles from "./ContentLibrary.module.css";
export function LibraryPagination({ page, meta, onChange }: { page: number; meta: Page<unknown>["meta"]; onChange: (page: number) => void }) {
  const totalPages = Math.max(1, meta.total_pages);
  const pages = [...new Set([1, totalPages, page - 1, page, page + 1].filter((value) => value >= 1 && value <= totalPages))].sort((a, b) => a - b);
  return <div className={styles.pagination}><span>{meta.total ? `显示 ${number((page - 1) * meta.page_size + 1)}–${number(Math.min(page * meta.page_size, meta.total))}，共 ${number(meta.total)} 篇` : "暂无内容"}</span>
    {!!meta.total && <nav aria-label="内容列表分页"><button type="button" aria-label="上一页" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={16} /></button>
      {pages.map((value, index) => <span key={value}>{index > 0 && value - pages[index - 1] > 1 && <i aria-hidden="true">…</i>}<button type="button" aria-label={`第 ${value} 页`} aria-current={page === value ? "page" : undefined} onClick={() => onChange(value)}>{value}</button></span>)}
      <button type="button" aria-label="下一页" disabled={page >= totalPages} onClick={() => onChange(page + 1)}><ChevronRight size={16} /></button></nav>}
  </div>;
}
