import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { AdminProfile, Experience, ProfileUpdate } from "../../../../shared/api/generated";
import { useUpdateProfile } from "../../../../shared/queries/profile";
import { profileApi } from "../../../../shared/api/profile";
import { useQueryClient } from "@tanstack/react-query";
import { keys } from "../../../../shared/queries/keys";
import { ApiError } from "../../../../shared/api/errors";
import { profileSchema } from "../../../../shared/schemas/profile";
import { validate } from "../../../../shared/schemas/common";
import { PageHeading } from "../../../../shared/components/ui/page-heading/PageHeading";
import { Button } from "../../../../shared/components/ui/button/Button";
import { Field } from "../../../../shared/components/ui/field/Field";
import { Dialog } from "../../../../shared/components/ui/dialog/Dialog";
import { ConfirmDialog } from "../../../../shared/components/ui/confirm-dialog/ConfirmDialog";
import { ConflictDialog } from "../../../../shared/components/feedback/conflict-dialog/ConflictDialog";
import { UnsavedChangesGuard } from "../../../../shared/components/feedback/unsaved-changes-guard/UnsavedChangesGuard";
import { ErrorNotice } from "../../../../shared/components/ui/error-notice/ErrorNotice";
import { ExperienceTimeline } from "../../../../shared/components/profile/experience-timeline/ExperienceTimeline";
import { useToast } from "../../../../shared/components/ui/toast/ToastProvider";
import { MonthPicker } from "./MonthPicker";
import styles from "./ExperienceEditor.module.css";
function toInput(profile: AdminProfile, experiences: Experience[]): ProfileUpdate {
  const { avatar: _avatar, updated_at: _updatedAt, ...input } = profile;
  return { ...input, experiences };
}
export function ExperienceEditor({ initial }: { initial: AdminProfile }) {
  const mutation = useUpdateProfile();
  const client = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<{ value: Experience; original: string; isNew: boolean }>();
  const [deleting, setDeleting] = useState<Experience>();
  const [deleted, setDeleted] = useState<{ value: Experience; index: number }>();
  const [discard, setDiscard] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<unknown>();
  const titleInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) titleInput.current?.focus(); }, [editing?.value.id]);
  const busy = mutation.isPending;
  const dirty = !!editing && JSON.stringify(editing.value) !== editing.original;
  const open = (entry?: Experience) => {
    const value = entry ? structuredClone(entry) : { id: crypto.randomUUID(), title: "", organization: "", start_date: "", end_date: null, description: "" };
    setEditing({ value, original: JSON.stringify(value), isNew: !entry }); setError(undefined);
  };
  const close = () => { if (busy) return; if (dirty) setDiscard(true); else { setEditing(undefined); setError(undefined); } };
  const change = (patch: Partial<Experience>) => { if (editing) setEditing({ ...editing, value: { ...editing.value, ...patch } }); setError(undefined); };
  async function persist(items: Experience[], message: string) {
    setError(undefined);
    try {
      await mutation.mutateAsync(validate(profileSchema, toInput(initial, items)));
      toast(message);
    } catch (error) {
      setError(error);
      if (error instanceof ApiError && error.code === "VERSION_CONFLICT") setConflict(true);
      throw error;
    }
  }
  async function save() {
    if (!editing) return;
    const value = { ...editing.value, title: editing.value.title.trim(), organization: editing.value.organization.trim(), description: editing.value.description.trim() };
    const items = editing.isNew ? [value, ...initial.experiences] : initial.experiences.map((row) => row.id === value.id ? value : row);
    await persist(items, "经历已保存"); setEditing(undefined);
  }
  const chronological = initial.experiences.every((entry, index, items) => index === 0 || items[index - 1].start_date <= entry.start_date);
  const reverseChronological = initial.experiences.every((entry, index, items) => index === 0 || items[index - 1].start_date >= entry.start_date);
  async function sortByTime(descending: boolean) {
    const items = [...initial.experiences].sort((a, b) => descending
      ? b.start_date.localeCompare(a.start_date) : a.start_date.localeCompare(b.start_date));
    if (items.every((item, index) => item.id === initial.experiences[index].id)) return;
    await persist(items, descending ? "已按时间倒序保存" : "已按时间顺序保存");
  }
  return <>
    <PageHeading eyebrow="ABOUT / TIMELINE" title="经历与足迹" description="把重要的阶段串起来，记录一路走来的探索。"
      actions={<Button disabled={busy || initial.experiences.length >= 30} onClick={() => open()}>＋ 新增经历</Button>} />
    {!editing && <ErrorNotice error={error} />}
    {deleted && <div className={styles.undo} role="status"><span>经历已删除。</span><Button variant="ghost" disabled={busy} onClick={() => {
      const items = [...initial.experiences];
      if (!items.some((item) => item.id === deleted.value.id)) items.splice(Math.min(deleted.index, items.length), 0, deleted.value);
      void persist(items, "经历已恢复").then(() => setDeleted(undefined)).catch(() => {});
    }}>撤销删除</Button></div>}
    <div className={styles.layout}>
      <section className={styles.library} aria-labelledby="experience-list-title">
        <header className={styles.heading}><div><h2 id="experience-list-title">时间线条目</h2><p>按开始时间排序，顺序同步到公开时间线。</p></div>
          <div className={styles.headingMeta}><span>共 {initial.experiences.length} 条</span>
            <div className={styles.order} role="group" aria-label="时间排序">
              <button type="button" aria-label="时间顺序" aria-pressed={chronological && !reverseChronological} disabled={busy || initial.experiences.length < 2} onClick={() => void sortByTime(false).catch(() => {})}><ArrowUp size={17} aria-hidden="true" /></button>
              <button type="button" aria-label="时间倒序" aria-pressed={reverseChronological && !chronological} disabled={busy || initial.experiences.length < 2} onClick={() => void sortByTime(true).catch(() => {})}><ArrowDown size={17} aria-hidden="true" /></button>
            </div>
          </div>
        </header>
        {initial.experiences.map((entry) => <article key={entry.id} className={styles.entry}>
          <div className={styles.entryTop}><div><p className={styles.period}>{entry.start_date} — {entry.end_date || "至今"}</p><h3>{entry.title}</h3>{entry.organization && <p className={styles.organization}>{entry.organization}</p>}</div>
          </div>
          {entry.description && <p className={styles.description}>{entry.description}</p>}
          <div className={styles.entryActions}><Button variant="ghost" disabled={busy} onClick={() => open(entry)}>编辑</Button><Button variant="ghost" className={styles.danger} disabled={busy} onClick={() => { setDeleting(entry); setError(undefined); }}>删除</Button></div>
        </article>)}
        {!initial.experiences.length && <div className={styles.empty}><h3>从第一条经历开始</h3><p>点击“新增经历”，记录一个重要阶段。</p></div>}
      </section>
      <aside className={styles.preview} aria-label="经历与足迹展示预览"><header><span>PREVIEW</span><h2>经历与足迹</h2></header><div className={styles.previewContent} role="region" aria-label="经历时间线预览内容" tabIndex={0}><ExperienceTimeline items={initial.experiences} variant="about" embedded /></div></aside>
    </div>
    <Dialog open={!!editing} title={editing?.isNew ? "新增经历" : "编辑经历"} onClose={close}>
      {editing && <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void save().catch(() => {}); }}>
        <fieldset disabled={busy} className={styles.formFields}>
          <Field label="经历标题"><input ref={titleInput} required maxLength={100} value={editing.value.title} placeholder="例如：AI 应用 · 大模型工程化" onChange={(e) => change({ title: e.target.value })} /></Field>
          <Field label="机构 / 地点"><input maxLength={120} value={editing.value.organization} placeholder="选填" onChange={(e) => change({ organization: e.target.value })} /></Field>
          <div className={styles.dates}>
            <Field label="开始时间"><MonthPicker label="开始时间" value={editing.value.start_date} onChange={(value) => change({ start_date: value })} /></Field>
            <Field label="结束时间"><MonthPicker label="结束时间" value={editing.value.end_date || ""} min={editing.value.start_date || undefined} disabled={editing.value.end_date === null} onChange={(value) => change({ end_date: value })} /></Field>
          </div>
          <label className={styles.checkbox}><input type="checkbox" checked={editing.value.end_date === null} onChange={(e) => change({ end_date: e.target.checked ? null : "" })} />持续至今</label>
          <Field label="经历描述"><textarea rows={4} maxLength={1000} value={editing.value.description} placeholder="介绍这一阶段的工作、收获或重要节点。" onChange={(e) => change({ description: e.target.value })} /></Field>
        </fieldset>
        <ErrorNotice error={error} />
        <div className={styles.formActions}><Button variant="ghost" disabled={busy} onClick={close}>取消</Button><Button type="submit" loading={busy}>保存经历</Button></div>
      </form>}
    </Dialog>
    <ConfirmDialog open={discard} title="放弃这条经历的未保存修改？" description="关闭后，本次未保存的时间和说明将丢失。" confirmText="放弃修改" onClose={() => setDiscard(false)} onConfirm={() => { setEditing(undefined); setDiscard(false); setError(undefined); }} />
    <ConfirmDialog open={!!deleting} title="删除这条经历？" description={`《${deleting?.title || ""}》将从时间线移除，删除后可撤销。`} confirmText="删除经历" danger onClose={() => setDeleting(undefined)} onConfirm={async () => {
      if (!deleting) return;
      const index = initial.experiences.findIndex((row) => row.id === deleting.id);
      await persist(initial.experiences.filter((row) => row.id !== deleting.id), "经历已删除"); setDeleted({ value: deleting, index });
    }} />
    <ConflictDialog open={conflict} values={editing?.value ?? initial.experiences} onClose={() => setConflict(false)} onReload={async () => { const { data } = await profileApi.admin(); client.setQueryData(keys.adminProfile, data); setEditing(undefined); setDeleting(undefined); setError(undefined); }} />
    <UnsavedChangesGuard dirty={dirty} />
  </>;
}
