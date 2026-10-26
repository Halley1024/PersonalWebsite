import { useUpdateSettings } from "../../../../shared/queries/settings";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  AdminSettings,
  SettingsUpdate,
} from "../../../../shared/api/generated";
import { settingsApi } from "../../../../shared/api/settings";
import { ApiError } from "../../../../shared/api/errors";
import { settingsSchema } from "../../../../shared/schemas/settings";
import { validate } from "../../../../shared/schemas/common";
import { useEditorState } from "../../../../shared/hooks/useEditorState";
import { Field } from "../../../../shared/components/ui/field/Field";
import { Button } from "../../../../shared/components/ui/button/Button";
import { ErrorNotice } from "../../../../shared/components/ui/error-notice/ErrorNotice";
import { UnsavedChangesGuard } from "../../../../shared/components/feedback/unsaved-changes-guard/UnsavedChangesGuard";
import { ConflictDialog } from "../../../../shared/components/feedback/conflict-dialog/ConflictDialog";
import { useToast } from "../../../../shared/components/ui/toast/ToastProvider";
import forms from "../../../../shared/styles/forms.module.css";
function input(s: AdminSettings): SettingsUpdate {
  return {
    site_name: s.site_name,
    site_description: s.site_description,
    footer_text: s.footer_text,
    default_seo_title: s.default_seo_title,
    default_seo_description: s.default_seo_description,
    version: s.version,
  };
}
export function SettingsForm({ initial }: { initial: AdminSettings }) {
  const form = useEditorState("settings", input(initial));
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const client = useQueryClient();
  const mutation = useUpdateSettings();
  const toast = useToast();
  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      const { data } = await mutation.mutateAsync(
        validate(settingsSchema, form.value),
      );
      form.accept(input(data));
      client.setQueryData(["admin", "settings"], data);
      toast("站点设置已保存");
    } catch (e) {
      setError(e);
      if (e instanceof ApiError && e.code === "VERSION_CONFLICT")
        setConflict(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <fieldset disabled={busy} className={forms.stack}>
        {(
          [
            "site_name",
            "site_description",
            "footer_text",
            "default_seo_title",
            "default_seo_description",
          ] as const
        ).map((key) => (
          <Field
            key={key}
            label={
              {
                site_name: "站点名称",
                site_description: "站点介绍",
                footer_text: "页脚文字",
                default_seo_title: "默认 SEO 标题（可选）",
                default_seo_description: "默认 SEO 描述（可选）",
              }[key]
            }
          >
            <input
              maxLength={
                key === "site_name"
                  ? 80
                  : key === "default_seo_title"
                    ? 70
                    : key === "default_seo_description"
                      ? 160
                      : 300
              }
              value={form.value[key] || ""}
              onChange={(e) =>
                form.setValue({
                  ...form.value,
                  [key]: key.startsWith("default_")
                    ? e.target.value || null
                    : e.target.value,
                })
              }
            />
          </Field>
        ))}
      </fieldset>
      <ErrorNotice error={error} />
      <div className={forms.actions}>
        <span className={forms.hint}>
          {form.dirty ? "有未保存修改" : `已保存 · 版本 ${form.value.version}`}
        </span>
        <Button
          loading={busy}
          disabled={!form.dirty}
          onClick={() => void save()}
        >
          保存设置
        </Button>
      </div>
      <UnsavedChangesGuard dirty={form.dirty} />
      <ConflictDialog
        open={conflict}
        values={form.value}
        onClose={() => setConflict(false)}
        onReload={async () => {
          const { data } = await settingsApi.admin();
          form.accept(input(data));
          client.setQueryData(["admin", "settings"], data);
          setError(undefined);
        }}
      />
    </>
  );
}
