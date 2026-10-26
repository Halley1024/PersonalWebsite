import { useState } from "react";
import { Dialog } from "../dialog/Dialog";
import { Button } from "../button/Button";
import { ErrorNotice } from "../error-notice/ErrorNotice";
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "确认",
  danger = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const close = () => {
    if (!busy) {
      setError(null);
      onClose();
    }
  };
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      title={title}
      onClose={close}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={close}>
            取消
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={busy}
            onClick={() => void confirm()}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <p>{description}</p>
      <ErrorNotice error={error} />
    </Dialog>
  );
}
