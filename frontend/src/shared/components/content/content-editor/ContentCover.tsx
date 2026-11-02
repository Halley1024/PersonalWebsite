import { useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { Field } from "../../ui/field/Field";
import { MediaPicker } from "../../media/media-picker/MediaPicker";
import styles from "./ContentCover.module.css";
export function ContentCover({ mediaId, alt, onChange }: {
  mediaId: string | null; alt: string; onChange: (value: { cover_media_id: string | null; cover_alt: string }) => void;
}) {
  const [picker, setPicker] = useState(false);
  return <div>
    <div className={styles.cover}>
      <button type="button" className={styles.trigger} aria-label="上传封面" onClick={() => setPicker(true)}>
        {mediaId ? <img src={`/api/v1/media/${mediaId}`} alt={alt || "当前封面预览"} /> : <span className={styles.placeholder}><ImageIcon size={32} aria-hidden="true" /><span>给内容一个视觉入口</span></span>}
        <span className={styles.overlay} aria-hidden="true">上传封面</span>
      </button>
      {mediaId && <button type="button" className={styles.remove} aria-label="移除封面" title="移除封面" onClick={() => onChange({ cover_media_id: null, cover_alt: "" })}><X size={16} aria-hidden="true" /></button>}
    </div>
    <p className={styles.hint}>建议 16:9，支持 JPG、PNG、WebP，最大 10 MiB。</p>
    <Field label="封面描述"><textarea className={styles.description} rows={3} maxLength={200} placeholder="描述画面，便于无障碍阅读" value={alt} onChange={(event) => onChange({ cover_media_id: mediaId, cover_alt: event.target.value })} /></Field>
    {picker && <MediaPicker open onClose={() => setPicker(false)} onSelect={(media) => onChange({ cover_media_id: media.id, cover_alt: !mediaId && alt ? alt : media.alt })} />}
  </div>;
}
