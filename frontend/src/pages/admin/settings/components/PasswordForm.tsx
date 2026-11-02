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
import { Dialog } from "../../../../shared/components/ui/dialog/Dialog";
import forms from "../../../../shared/styles/forms.module.css";
import styles from "./PasswordForm.module.css";
export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const client = useQueryClient();
  const navigate = useNavigate();
  const close = () => { if (!busy) { setConfirm(false); setCurrent(""); setError(undefined); } };
  async function save() {
    setError(undefined);
    try {
      const body = validate(passwordSchema, { current_password: current, new_password: next });
      setBusy(true);
      await authApi.password(body);
      setCurrent(""); setNext("");
      clearDrafts(); setCsrfToken(null);
      await client.cancelQueries({ queryKey: ["admin"] });
      client.removeQueries({ queryKey: ["admin"] });
      client.setQueryData(["session"], { authenticated: false });
      navigate("/admin/login", { replace: true });
    } catch (error) { setError(error); } finally { setBusy(false); }
  }
  return <>
    <div className={forms.stack}>
      <Field label="当前密码" hint="修改密码时需验证原密码。">
        <input className={styles.masked} type="password" autoComplete="off" value="************" readOnly disabled />
      </Field>
      <Field label="新密码" hint="8–128 个字符；修改后所有会话会失效。">
        <input type="password" autoComplete="new-password" value={next} disabled={busy} onChange={(event) => setNext(event.target.value)} />
      </Field>
      {!confirm && <ErrorNotice error={error} />}
      <Button variant="danger" disabled={!next || busy} onClick={() => {
        try {
          validate(passwordSchema.pick({ new_password: true }), { new_password: next });
          setCurrent(""); setError(undefined); setConfirm(true);
        } catch (error) { setError(error); }
      }}>修改密码</Button>
    </div>
    <Dialog open={confirm} title="修改管理员密码" onClose={close}>
      <form className={styles.verification} onSubmit={(event) => { event.preventDefault(); if (!busy) void save(); }}>
        <p>修改成功后将撤销全部登录会话，并跳转登录页。请先保存其他未完成的编辑。</p>
        <Field label="验证当前密码"><input type="password" autoComplete="current-password" autoFocus value={current} disabled={busy} onChange={(event) => setCurrent(event.target.value)} /></Field>
        <ErrorNotice error={error} />
        <div className={styles.actions}><Button variant="ghost" disabled={busy} onClick={close}>取消</Button><Button type="submit" variant="danger" disabled={!current} loading={busy}>确认修改</Button></div>
      </form>
    </Dialog>
  </>;
}
