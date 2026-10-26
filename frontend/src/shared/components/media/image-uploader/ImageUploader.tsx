import { useMediaMutations } from "../../../queries/media";
import { useEffect, useRef, useState } from "react";
import type { Media } from "../../../api/generated";
import { Button } from "../../ui/button/Button";
import { Field } from "../../ui/field/Field";
import { ErrorNotice } from "../../ui/error-notice/ErrorNotice";
import styles from "./ImageUploader.module.css";
export function ImageUploader({
  onUploaded,
}: {
  onUploaded: (media: Media) => void;
}) {
  const [file, setFile] = useState<File>();
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const mutations = useMediaMutations();
  async function upload() {
    if (!file) return;
    setError(undefined);
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      setError(new Error("请选择不超过 10 MiB 的 JPEG、PNG 或 WebP 图片"));
      return;
    }
    setBusy(true);
    try {
      const { data } = await mutations.upload.mutateAsync({
        file: file,
        alt: alt,
      });
      if (!mounted.current) return;
      onUploaded(data);
      setFile(undefined);
      setAlt("");
      if (input.current) input.current.value = "";
    } catch (e) {
      if (mounted.current) setError(e);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className={styles.upload}>
      <Field label="上传图片" hint="JPEG / PNG / WebP，单张不超过 10 MiB">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => setFile(e.target.files?.[0])}
        />
      </Field>
      <Field label="图片描述（替代文本）">
        <input
          maxLength={200}
          value={alt}
          disabled={busy}
          onChange={(e) => setAlt(e.target.value)}
        />
      </Field>
      <Button disabled={!file} loading={busy} onClick={() => void upload()}>
        上传到媒体库
      </Button>
      <ErrorNotice error={error} />
    </div>
  );
}
