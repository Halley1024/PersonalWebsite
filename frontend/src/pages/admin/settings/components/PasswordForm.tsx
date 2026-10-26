import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "../../../../shared/api/auth";
import { setCsrfToken } from "../../../../shared/api/client";
import { passwordSchema } from "../../../../shared/schemas/auth";
import { validate } from "../../../../shared/schemas/common";
import { clearDrafts } from "../../../../shared/session/drafts";
import { Button } from "../../../../shared/components/ui/button/Button";
import { Field } from "../../../../shared/components/ui/field/Field";
import { ErrorNotice } from "../../../../shared/components/ui/error-notice/ErrorNotice";
import { ConfirmDialog } from "../../../../shared/components/ui/confirm-dialog/ConfirmDialog";
import forms from "../../../../shared/styles/forms.module.css";
export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<unknown>();
  const client = useQueryClient();
  const navigate = useNavigate();
  return (
    <>
      <div className={forms.stack}>
        <Field label="当前密码">
          <input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field label="新密码" hint="8–128 个字符；修改后所有会话会失效。">
          <input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </Field>
        <ErrorNotice error={error} />
        <Button
          variant="danger"
          disabled={!current || !next}
          onClick={() => {
            try {
              validate(passwordSchema, {
                current_password: current,
                new_password: next,
              });
              setError(undefined);
              setConfirm(true);
            } catch (e) {
              setError(e);
            }
          }}
        >
          修改密码
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        title="修改管理员密码"
        description="修改成功后将撤销全部登录会话，并跳转登录页。请先保存其他未完成的编辑。"
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await authApi.password(
            validate(passwordSchema, {
              current_password: current,
              new_password: next,
            }),
          );
          setCurrent("");
          setNext("");
          clearDrafts();
          setCsrfToken(null);
          await client.cancelQueries({ queryKey: ["admin"] });
          client.removeQueries({ queryKey: ["admin"] });
          client.setQueryData(["session"], { authenticated: false });
          navigate("/admin/login", { replace: true });
        }}
      />
    </>
  );
}
