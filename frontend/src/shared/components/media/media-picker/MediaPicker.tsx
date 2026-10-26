import { useState } from "react";
import type { Media } from "../../../api/generated";
import { useMedia } from "../../../queries/media";
import { Dialog } from "../../ui/dialog/Dialog";
import { QueryState } from "../../ui/query-state/QueryState";
import { Pagination } from "../../ui/pagination/Pagination";
import { ImageUploader } from "../image-uploader/ImageUploader";
import styles from "./MediaPicker.module.css";
export function MediaPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (item: Media) => void;
}) {
  const [page, setPage] = useState(1);
  const query = useMedia({ page, page_size: 12 });
  const choose = (item: Media) => {
    onSelect(item);
    onClose();
  };
  return (
    <Dialog open={open} title="选择媒体" wide onClose={onClose}>
      <ImageUploader onUploaded={choose} />
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        empty={query.data?.data.length === 0}
      >
        <div className={styles.grid}>
          {query.data?.data.map((item) => (
            <button
              type="button"
              key={item.id}
              className={styles.item}
              onClick={() => choose(item)}
            >
              <img
                src={item.thumbnail_url || item.url}
                alt={item.alt}
                loading="lazy"
              />
              <span>
                {item.alt || "未填写描述"}
                <small>
                  {item.width} × {item.height}
                </small>
              </span>
            </button>
          ))}
        </div>
      </QueryState>
      {query.data && (
        <Pagination
          page={page}
          total={query.data.meta.total}
          totalPages={query.data.meta.total_pages}
          onChange={setPage}
        />
      )}
    </Dialog>
  );
}
