import { useEffect, useState, type FormEvent } from "react";
import { Search, Trash2, Upload, Image as ImageIcon } from "lucide-react";
import type { Media } from "../../../shared/api/generated";
import { useMedia, useMediaMutations, useMediaStats } from "../../../shared/queries/media";
import { useUrlFilters } from "../../../shared/hooks/useUrlFilters";
import { useSeo } from "../../../shared/hooks/useSeo";
import { isKind } from "../../../shared/utils/content";
import { date, number } from "../../../shared/utils/date";
import { PageHeading } from "../../../shared/components/ui/page-heading/PageHeading";
import { QueryState } from "../../../shared/components/ui/query-state/QueryState";
import { ContentPagination } from "../../../shared/components/ui/content-pagination/ContentPagination";
import { Button } from "../../../shared/components/ui/button/Button";
import { Dialog } from "../../../shared/components/ui/dialog/Dialog";
import { ErrorNotice } from "../../../shared/components/ui/error-notice/ErrorNotice";
import { ConfirmDialog } from "../../../shared/components/ui/confirm-dialog/ConfirmDialog";
import { ImageUploader } from "../../../shared/components/media/image-uploader/ImageUploader";
import styles from "./Page.module.css";
const labels = { all: "全部", blog: "技术博客", project: "项目作品", life: "生活记录", unused: "未引用" };
const size = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MiB` : `${Math.max(1, Math.round(bytes / 1024))} KiB`;
export default function Page() {
  const { page, params, update } = useUrlFilters();
  const rawKind = params.get("kind");
  const active = params.get("unused") === "true" ? "unused" : isKind(rawKind) ? rawKind : "all";
  const q = params.get("q") || "";
  const [text, setText] = useState(q);
  const query = useMedia({ page, page_size: 12, q, ...(active === "unused" ? { unused: true } : isKind(active) ? { kind: active } : {}) });
  const stats = useMediaStats();
  const [deleting, setDeleting] = useState(false);
  const [remove, setRemove] = useState<Media>();
  const [uploading, setUploading] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [preview, setPreview] = useState<Media>();
  const [previewError, setPreviewError] = useState(false);
  const mutations = useMediaMutations();
  useEffect(() => setText(q), [q]);
  useEffect(() => {
    if (query.data && page > Math.max(1, query.data.meta.total_pages)) update({ page: Math.max(1, query.data.meta.total_pages) }, true);
  }, [page, query.data]);
  useSeo("媒体库");
  const count = (key: keyof typeof labels) => stats.data ? number(stats.data[key]) : "—";
  const search = (event: FormEvent) => { event.preventDefault(); update({ q: text.trim() }); };
  return <div className={styles.page}>
    <PageHeading eyebrow="MEDIA / LIBRARY" title="媒体库" description="整理博客、作品与生活的图片，让每一张画面都有自己的位置。"
      actions={<><Button variant="ghost" className={deleting ? styles.deleteActive : ""} aria-pressed={deleting} onClick={() => setDeleting(!deleting)}><Trash2 size={16} aria-hidden="true" />{deleting ? "完成删除" : "删除"}</Button><Button onClick={() => setUploading(true)}><Upload size={16} aria-hidden="true" />上传</Button></>} />
    <div className={styles.stats} aria-label="媒体统计">
      {(["blog", "project", "life", "unused"] as const).map((key) => <section key={key} data-kind={key}><span>{labels[key]}</span><strong>{count(key)}</strong></section>)}
    </div>
    {stats.error && <div className={styles.statsError}><ErrorNotice error={stats.error} /><Button variant="ghost" onClick={() => void stats.refetch()}>重试统计</Button></div>}
    <section className={styles.library} aria-label="媒体资源">
      <div className={styles.tabs} role="group" aria-label="媒体类型筛选">
        {Object.entries(labels).map(([key, label]) => <button key={key} type="button" aria-pressed={active === key} onClick={() => update({ kind: isKind(key) ? key : "", unused: key === "unused" })}>{label}<small>{count(key as keyof typeof labels)}</small></button>)}
      </div>
      <form className={styles.toolbar} role="search" aria-label="搜索媒体描述" onSubmit={search}>
        <label className={styles.search}><Search size={17} aria-hidden="true" /><input type="search" aria-label="媒体描述" placeholder="搜索图片描述…" maxLength={100} value={text} onChange={(event) => setText(event.target.value)} /></label>
        <Button variant="ghost" type="submit">搜索</Button><span className={styles.result} role="status">{query.data ? `共 ${number(query.data.meta.total)} 张图片` : "正在读取图片…"}</span>
      </form>
      {deleting && <p className={styles.hint}>点击图片右上角的删除图标移除图片；已被引用的图片无法删除。</p>}
      <QueryState loading={query.isPending} error={query.error} empty={query.data?.data.length === 0} emptyText="没有找到符合条件的图片。" emptyAction={<Button variant="ghost" onClick={() => update({ kind: "", unused: false, q: "" })}>清除筛选</Button>} retry={() => void query.refetch()}>
        <div className={styles.grid}>{query.data?.data.map((item) => <article key={item.id} className={styles.card}>
          <button type="button" className={styles.imageButton} aria-label={`预览${item.alt || "未填写描述的图片"}`} onClick={() => { setPreview(item); setPreviewError(false); }}>
            <ImageIcon className={styles.placeholder} size={32} aria-hidden="true" />
            <img src={item.thumbnail_url || item.url} alt={item.alt} width={item.width} height={item.height} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />
          </button>
          <div className={styles.caption}><h2 title={item.alt}>{item.alt || "未填写描述"}</h2><p><span>{item.width} × {item.height}</span><span>{size(item.byte_size)}</span><span>{item.mime_type.split("/")[1].toUpperCase()}</span></p><p><time dateTime={item.created_at}>{date(item.created_at)}</time><span>引用 {number(item.reference_count)} 次</span></p></div>
          {deleting && <button type="button" className={styles.remove} aria-label={`删除${item.alt || "未填写描述的图片"}`} title={item.reference_count > 0 ? "图片已被引用，无法删除" : "删除图片"} disabled={item.reference_count > 0} onClick={() => setRemove(item)}><Trash2 size={17} aria-hidden="true" /></button>}
        </article>)}</div>
      </QueryState>
      {query.data && <div className={styles.pagination}><ContentPagination page={page} total={query.data.meta.total} totalPages={query.data.meta.total_pages} summary={`共 ${number(query.data.meta.total)} 张图片 · 第 ${page} / ${Math.max(1, query.data.meta.total_pages)} 页`} ariaLabel="媒体分页" onChange={(page) => update({ page }, true)} /></div>}
    </section>
    <Dialog open={!!preview} title="图片预览" wide onClose={() => setPreview(undefined)}>
      {preview && <div className={styles.preview}>{previewError ? <p role="alert">图片加载失败，请关闭预览后重试。</p> : <img src={preview.url} alt={preview.alt || "未填写描述"} width={preview.width} height={preview.height} onError={() => setPreviewError(true)} />}<h2>{preview.alt || "未填写描述"}</h2><p>{preview.width} × {preview.height} · {size(preview.byte_size)} · {preview.mime_type} · 引用 {number(preview.reference_count)} 次</p><p>上传于 {date(preview.created_at, true)}</p></div>}
    </Dialog>
    <Dialog open={uploading} title="上传图片" onClose={() => { if (!uploadBusy) setUploading(false); }}>
      {uploading && <div className={styles.upload}><ImageUploader onBusyChange={setUploadBusy} onUploaded={() => { setUploading(false); setUploadBusy(false); update({ kind: "", unused: false, q: "" }); }} /></div>}
    </Dialog>
    <ConfirmDialog open={!!remove} title="永久删除图片" description="只能删除没有引用的图片。删除后无法通过应用恢复。" confirmText="删除图片" danger onClose={() => setRemove(undefined)} onConfirm={async () => { if (remove) await mutations.remove.mutateAsync(remove.id); }} />
  </div>;
}
