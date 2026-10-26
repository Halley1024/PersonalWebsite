import { useRef, useState } from "react";
import { Button } from "../../ui/button/Button";
import { MediaPicker } from "../../media/media-picker/MediaPicker";
import { MarkdownRenderer } from "../markdown-renderer/MarkdownRenderer";
import styles from "./MarkdownEditor.module.css";
export function MarkdownEditor({
  value,
  onChange,
  images = true,
}: {
  value: string;
  onChange: (value: string) => void;
  images?: boolean;
}) {
  const [preview, setPreview] = useState(false);
  const [picker, setPicker] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>
        <span>MARKDOWN / GFM</span>
        <div>
          {images && (
            <Button variant="ghost" onClick={() => setPicker(true)}>
              插入图片
            </Button>
          )}
          <Button variant="ghost" onClick={() => setPreview(!preview)}>
            {preview ? "返回编辑" : "预览正文"}
          </Button>
        </div>
      </div>
      {preview ? (
        <div className={styles.preview}>
          <MarkdownRenderer value={value || "暂无正文"} />
        </div>
      ) : (
        <textarea
          ref={ref}
          aria-label="Markdown 正文"
          value={value}
          maxLength={images ? 200000 : 20000}
          onChange={(e) => onChange(e.target.value)}
          placeholder="# 从这里开始记录…"
        />
      )}
      {images && picker && (
        <MediaPicker
          open
          onClose={() => setPicker(false)}
          onSelect={(item) => {
            const start = ref.current?.selectionStart ?? value.length;
            const end = ref.current?.selectionEnd ?? start;
            const alt = item.alt.replace(/[\[\]\n]/g, " ");
            onChange(
              value.slice(0, start) +
                `\n![${alt}](media:${item.id})\n` +
                value.slice(end),
            );
          }}
        />
      )}
      <div className={styles.hint}>
        {value.length.toLocaleString()} 字符 · 图片上传后仍需保存内容引用
      </div>
    </div>
  );
}
