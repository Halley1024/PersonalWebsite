import { useState } from "react";
import { Dialog } from "../../ui/dialog/Dialog";
import { Button } from "../../ui/button/Button";
import { ErrorNotice } from "../../ui/error-notice/ErrorNotice";
export function ConflictDialog({
  open,
  onClose,
  onReload,
  values,
}: {
  open: boolean;
  onClose: () => void;
  onReload: () => Promise<unknown>;
  values: unknown;
}) {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      title="服务器上的内容已更新"
      onClose={onClose}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              navigator.clipboard
                .writeText(JSON.stringify(values, null, 2))
                .catch(setError);
            }}
          >
            复制当前内容
          </Button>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onReload();
                onClose();
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            放弃本地修改并重新加载
          </Button>
        </>
      }
    >
      <p>
        另一个页面可能保存了新版本。当前表单仍保留，请先复制需要保留的内容，再决定是否加载服务器版本。
      </p>
      <ErrorNotice error={error} />
    </Dialog>
  );
}
