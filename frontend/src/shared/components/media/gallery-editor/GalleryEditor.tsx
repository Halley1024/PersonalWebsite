import { useState } from "react";
import type { GalleryInput } from "../../../api/generated";
import { Button } from "../../ui/button/Button";
import { MediaPicker } from "../media-picker/MediaPicker";
import styles from "./GalleryEditor.module.css";
export function GalleryEditor({
  value,
  onChange,
}: {
  value: GalleryInput[];
  onChange: (value: GalleryInput[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const arrange = (items: GalleryInput[]) =>
    onChange(items.map((item, position) => ({ ...item, position })));
  const move = (index: number, delta: number) => {
    const next = [...value];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    arrange(next);
  };
  return (
    <div className={styles.gallery}>
      {value.map((item, index) => (
        <div className={styles.item} key={item.media_id}>
          <img
            src={`/api/v1/media/${item.media_id}?variant=thumb`}
            alt={item.alt}
          />
          <input
            aria-label={`第 ${index + 1} 张图片描述`}
            maxLength={200}
            value={item.alt}
            onChange={(e) =>
              onChange(
                value.map((row, i) =>
                  i === index ? { ...row, alt: e.target.value } : row,
                ),
              )
            }
          />
          <div>
            <Button
              variant="ghost"
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              上移
            </Button>
            <Button
              variant="ghost"
              disabled={index === value.length - 1}
              onClick={() => move(index, 1)}
            >
              下移
            </Button>
            <Button
              variant="danger"
              onClick={() => arrange(value.filter((_, i) => i !== index))}
            >
              移除
            </Button>
          </div>
        </div>
      ))}
      <Button
        variant="ghost"
        disabled={value.length >= 20}
        onClick={() => setOpen(true)}
      >
        ＋ 添加相册图片（{value.length}/20）
      </Button>
      {open && (
        <MediaPicker
          open
          onClose={() => setOpen(false)}
          onSelect={(media) => {
            if (!value.some((item) => item.media_id === media.id))
              arrange([
                ...value,
                { media_id: media.id, alt: media.alt, position: value.length },
              ]);
          }}
        />
      )}
    </div>
  );
}
