import styles from "./ContentPagination.module.css";

export function ContentPagination({
  page,
  totalPages,
  total,
  onChange,
  summary,
  ariaLabel = "分页",
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
  summary?: string;
  ariaLabel?: string;
}) {
  if (!total) return null;
  const count = Math.max(1, totalPages);
  const numbers = count <= 7
    ? Array.from({ length: count }, (_, index) => index + 1)
    : Array.from(new Set([1, page - 1, page, page + 1, count]))
      .filter((number) => number >= 1 && number <= count)
      .sort((a, b) => a - b);
  return (
    <nav className={styles.pagination} aria-label={ariaLabel}>
      <span>{summary || `第 ${page} / ${count} 页`}</span>
      <div className={styles.paginationControls}>
        <button type="button" className={styles.pageButton} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          ← 上一页
        </button>
        {numbers.map((number, index) => (
          <span key={number}>
            {index > 0 && number - numbers[index - 1] > 1 && <span aria-hidden="true">… </span>}
            <button
              type="button"
              className={styles.pageButton}
              aria-label={`第 ${number} 页`}
              aria-current={number === page ? "page" : undefined}
              onClick={() => onChange(number)}
            >
              {number}
            </button>
          </span>
        ))}
        <button type="button" className={styles.pageButton} disabled={page >= count} onClick={() => onChange(page + 1)}>
          下一页 →
        </button>
      </div>
    </nav>
  );
}
