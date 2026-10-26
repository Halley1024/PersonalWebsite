import { useMediaMutations } from "../../../shared/queries/media";
import { useState } from "react";
import type { Media } from "../../../shared/api/generated";
import { useMedia } from "../../../shared/queries/media";
import { useUrlFilters } from "../../../shared/hooks/useUrlFilters";
import { useSeo } from "../../../shared/hooks/useSeo";
import { PageHeading } from "../../../shared/components/ui/page-heading/PageHeading";
import { QueryState } from "../../../shared/components/ui/query-state/QueryState";
import { Pagination } from "../../../shared/components/ui/pagination/Pagination";
import { Button } from "../../../shared/components/ui/button/Button";
import { ConfirmDialog } from "../../../shared/components/ui/confirm-dialog/ConfirmDialog";
import { ImageUploader } from "../../../shared/components/media/image-uploader/ImageUploader";
import forms from "../../../shared/styles/forms.module.css";
import styles from "./Page.module.css";
export default function Page() {
  const { page, params, update } = useUrlFilters();
  const unused = params.get("unused") === "true";
  const query = useMedia({
    page,
    page_size: 20,
    ...(unused ? { unused: true } : {}),
  });
  const [remove, setRemove] = useState<Media>();
  const mutations = useMediaMutations();
  useSeo("媒体库");
  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="MEDIA / LIBRARY"
        title="媒体库"
        description="图片先上传到私有媒体库，被已发布内容引用后才对访客开放。"
      />
      <ImageUploader onUploaded={() => update({ page: 1 }, true)} />
      <label className={styles.filter}>
        <input
          type="checkbox"
          checked={unused}
          onChange={(e) => update({ unused: e.target.checked })}
        />
        仅看未引用图片
      </label>
      <QueryState
        loading={query.isPending}
        error={query.error}
        empty={query.data?.data.length === 0}
        retry={() => void query.refetch()}
        emptyText="媒体库暂时没有符合条件的图片。"
      >
        <div className={styles.grid}>
          {query.data?.data.map((item) => (
            <article key={item.id} className={styles.card}>
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                <img
                  src={item.thumbnail_url || item.url}
                  alt={item.alt}
                  loading="lazy"
                />
              </a>
              <div>
                <strong>{item.alt || "未填写描述"}</strong>
                <small>
                  {item.width} × {item.height} ·{" "}
                  {(item.byte_size / 1024).toFixed(0)} KiB
                </small>
                <span className={forms.hint}>
                  被引用 {item.reference_count} 次
                </span>
                <Button
                  variant="danger"
                  disabled={item.reference_count > 0}
                  onClick={() => setRemove(item)}
                >
                  删除
                </Button>
              </div>
            </article>
          ))}
        </div>
      </QueryState>
      {query.data && (
        <Pagination
          page={page}
          total={query.data.meta.total}
          totalPages={query.data.meta.total_pages}
          onChange={(page) => update({ page }, true)}
        />
      )}
      <ConfirmDialog
        open={!!remove}
        title="永久删除图片"
        description="只能删除没有引用的图片。删除后无法通过应用恢复。"
        danger
        onClose={() => setRemove(undefined)}
        onConfirm={async () => {
          if (remove) {
            await mutations.remove.mutateAsync(remove.id);
          }
        }}
      />
    </div>
  );
}
