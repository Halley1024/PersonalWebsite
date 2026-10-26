import { useContentMutations } from "../../../queries/content";
import { useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { contentApi, type Kind } from "../../../api/content";
import type { AdminDetail } from "../../../api/generated";
import { ApiError, errorMessage } from "../../../api/errors";
import {
  createContentSchema,
  updateContentSchema,
} from "../../../schemas/content";
import { validate } from "../../../schemas/common";
import { useEditorState } from "../../../hooks/useEditorState";
import { useSeo } from "../../../hooks/useSeo";
import { toDraft, emptyContent } from "../content-editor/types";
import { ContentEditor } from "../content-editor/ContentEditor";
import { PageHeading } from "../../ui/page-heading/PageHeading";
import { Button, ButtonLink } from "../../ui/button/Button";
import { ErrorNotice } from "../../ui/error-notice/ErrorNotice";
import { ConfirmDialog } from "../../ui/confirm-dialog/ConfirmDialog";
import { ConflictDialog } from "../../feedback/conflict-dialog/ConflictDialog";
import { UnsavedChangesGuard } from "../../feedback/unsaved-changes-guard/UnsavedChangesGuard";
import { useToast } from "../../ui/toast/ToastProvider";
import { removeDraft } from "../../../session/drafts";
import { kindNames } from "../../../utils/content";
import styles from "./ContentWorkspace.module.css";
export function ContentWorkspace({
  item,
  kind,
  reload,
}: {
  item?: AdminDetail;
  kind: Kind;
  reload?: () => Promise<unknown>;
}) {
  const location = useLocation();
  const key = item ? `content:${item.id}` : `content:new:${kind}`;
  const form = useEditorState(key, item ? toDraft(item) : emptyContent(kind));
  const [server, setServer] = useState(item);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(() =>
    location.state?.publishError
      ? new Error(location.state.publishError)
      : undefined,
  );
  const [publish, setPublish] = useState(false);
  const [conflict, setConflict] = useState(false);
  const allow = useRef(false);
  const navigate = useNavigate();
  const client = useQueryClient();
  const mutations = useContentMutations();
  const toast = useToast();
  useSeo(item ? "编辑内容" : "创建内容");
  async function persist() {
    if (server) {
      const input = validate(updateContentSchema, form.value);
      return (
        await mutations.update.mutateAsync({ id: server.id, body: input })
      ).data;
    }
    const input = validate(createContentSchema, form.value);
    return (await mutations.create.mutateAsync(input)).data;
  }
  async function save(publishing = false) {
    setBusy(true);
    setError(undefined);
    let current = server;
    let failure: unknown;
    try {
      if (form.dirty || !current) {
        current = await persist();
        setServer(current);
        form.accept(toDraft(current));
        toast("内容已保存");
      }
      if (publishing && current && current.status !== "published") {
        try {
          current = (
            await mutations.status.mutateAsync({
              id: current.id,
              body: {
                status: "published",
                version: current.version,
              },
            })
          ).data;
          setServer(current);
          form.accept(toDraft(current));
          toast("内容已发布");
        } catch (e) {
          setError(e);
          if (e instanceof ApiError && e.code === "VERSION_CONFLICT")
            setConflict(true);
          throw e;
        }
      }
      if (current) {
        client.setQueryData(["admin", "content", current.id], current);
      }
    } catch (e) {
      failure = e;
      setError(e);
      if (e instanceof ApiError && e.code === "VERSION_CONFLICT")
        setConflict(true);
      if (publishing) throw e;
    } finally {
      setBusy(false);
      if (!item && current) {
        removeDraft(key);
        allow.current = true;
        navigate(`/admin/contents/${current.id}/edit`, {
          replace: true,
          state: failure
            ? {
                publishError: `草稿已保存，但发布未完成：${errorMessage(failure)}`,
              }
            : null,
        });
      }
    }
  }
  return (
    <>
      <PageHeading
        eyebrow={`CONTENT / ${kind.toUpperCase()}`}
        title={`${item ? "编辑" : "新建"}${kindNames[kind]}`}
        description={
          server?.status === "published"
            ? "当前内容已公开，保存会立即更新公开页面。"
            : server?.status === "archived"
              ? "当前内容已归档，请先在内容列表恢复草稿。"
              : "先保存想法，再让它与世界见面。"
        }
        actions={
          <>
            <ButtonLink to="/admin/contents">返回列表</ButtonLink>
            <Button
              variant="ghost"
              loading={busy}
              disabled={server?.status === "archived"}
              onClick={() => void save()}
            >
              保存{server?.status === "published" ? "更新" : "草稿"}
            </Button>
            {server?.status !== "published" && (
              <Button
                disabled={busy || server?.status === "archived"}
                onClick={() => setPublish(true)}
              >
                发布内容
              </Button>
            )}
          </>
        }
      />
      <ErrorNotice error={error} />
      <div className={styles.state} role="status">
        {form.dirty ? "● 有未保存的修改" : "✓ 当前修改已保存"}
        {server && (
          <span>
            版本 {server.version} · {server.status}
          </span>
        )}
      </div>
      <ContentEditor
        value={form.value}
        onChange={form.setValue}
        editing={!!server}
        disabled={busy || server?.status === "archived"}
      />
      <UnsavedChangesGuard dirty={form.dirty} allowNavigation={allow} />
      <ConfirmDialog
        open={publish}
        title="发布到公开网站"
        description="如有未保存修改，将先保存内容，再发布。发布后访客可阅读正文和关联图片。"
        confirmText="保存并发布"
        onClose={() => setPublish(false)}
        onConfirm={() => save(true)}
      />
      <ConflictDialog
        open={conflict}
        onClose={() => setConflict(false)}
        values={form.value}
        onReload={async () => {
          if (server) {
            const result = await contentApi.adminDetail(server.id);
            setServer(result.data);
            form.accept(toDraft(result.data));
            client.setQueryData(["admin", "content", server.id], result.data);
          } else await reload?.();
          setError(undefined);
        }}
      />
    </>
  );
}
