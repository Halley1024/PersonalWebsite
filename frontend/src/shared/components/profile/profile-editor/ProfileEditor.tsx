import { useUpdateProfile } from "../../../queries/profile";
import { useState, type ReactNode } from "react";
import { Undo2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { AdminProfile, ProfileUpdate } from "../../../api/generated";
import { profileApi } from "../../../api/profile";
import { ApiError } from "../../../api/errors";
import { profileSchema } from "../../../schemas/profile";
import { validate } from "../../../schemas/common";
import { useEditorState } from "../../../hooks/useEditorState";
import { Field } from "../../ui/field/Field";
import { Panel } from "../../ui/panel/Panel";
import { Button } from "../../ui/button/Button";
import { ErrorNotice } from "../../ui/error-notice/ErrorNotice";
import { useToast } from "../../ui/toast/ToastProvider";
import { MediaPicker } from "../../media/media-picker/MediaPicker";
import { UnsavedChangesGuard } from "../../feedback/unsaved-changes-guard/UnsavedChangesGuard";
import { ConflictDialog } from "../../feedback/conflict-dialog/ConflictDialog";
import forms from "../../../styles/forms.module.css";
import styles from "./ProfileEditor.module.css";
import { SkillGroupEditor } from "./SkillGroupEditor";
type SocialKind = "GitHub" | "Bilibili";
function matchesSocial(link: ProfileUpdate["social_links"][number], kind: SocialKind) {
  if (link.label.toLowerCase() === kind.toLowerCase()) return true;
  try {
    const host = new URL(link.url).hostname;
    const domain = kind === "GitHub" ? "github.com" : "bilibili.com";
    return host === domain || host.endsWith(`.${domain}`);
  } catch { return false; }
}
function toInput(p: AdminProfile): ProfileUpdate {
  return {
    display_name: p.display_name,
    headline: p.headline,
    intro: p.intro,
    stats: p.stats,
    bio_markdown: p.bio_markdown,
    avatar_media_id: p.avatar_media_id,
    location_label: p.location_label,
    public_email: p.public_email,
    social_links: p.social_links,
    skill_groups: p.skill_groups,
    experiences: p.experiences,
    version: p.version,
  };
}
export function ProfileEditor({
  initial,
  experiences = false,
  renderHeading,
  renderPreview,
}: {
  initial: AdminProfile;
  experiences?: boolean;
  renderHeading?: (actions: ReactNode) => ReactNode;
  renderPreview?: (value: ProfileUpdate, dirty: boolean) => ReactNode;
}) {
  const form = useEditorState(
    `profile:${experiences ? "experiences" : "details"}`,
    toInput(initial),
    { history: true },
  );
  const value = {
    ...form.value,
    stats: { ...form.value.stats, projects: initial.stats.projects, notes: initial.stats.notes },
  };
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [conflict, setConflict] = useState(false);
  const client = useQueryClient();
  const mutation = useUpdateProfile();
  const toast = useToast();
  const set = <K extends keyof ProfileUpdate>(key: K, v: ProfileUpdate[K]) =>
    form.setValue({ ...value, [key]: v });
  const socialValue = (kind: SocialKind) => value.social_links.find((link) => matchesSocial(link, kind))?.url || "";
  const setSocial = (kind: SocialKind, url: string) => {
    const remaining = value.social_links.filter((link) => !matchesSocial(link, kind));
    set("social_links", url.trim() ? [...remaining, { label: kind, url: url.trim() }] : remaining);
  };
  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      const input = validate(profileSchema, value);
      const { data } = await mutation.mutateAsync(input);
      form.accept(toInput(data));
      client.setQueryData(["admin", "profile"], data);
      toast("个人资料已保存");
    } catch (e) {
      setError(e);
      if (e instanceof ApiError && e.code === "VERSION_CONFLICT")
        setConflict(true);
    } finally {
      setBusy(false);
    }
  }
  function move(index: number, delta: number) {
    const next = [...value.experiences];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    set("experiences", next);
  }
  return (
    <div className={styles.editor}>
      {renderHeading && <div className={styles.heading}>{renderHeading(<div className={styles.saveActions}>
        <span role="status">{form.dirty ? "有未保存的修改" : "所有修改已保存"}</span>
        {form.dirty && <>
          <Button variant="ghost" disabled={busy || !form.canUndo} onClick={() => { form.undo(); setError(undefined); }}><Undo2 size={16} aria-hidden="true" />撤销</Button>
          <Button variant="ghost" className={styles.discardButton} disabled={busy} onClick={() => { form.discard(); setError(undefined); }}>放弃修改</Button>
        </>}
        <Button loading={busy} disabled={!form.dirty} onClick={() => void save()}>保存{experiences ? "经历" : "个人介绍"}</Button>
      </div>)}</div>}
      <div className={renderPreview ? styles.layout : undefined}>
      <div className={styles.fields}>
      <ErrorNotice error={error} />
      <fieldset disabled={busy} className={forms.stack}>
        {experiences ? (
          <>
            <Panel
              className={styles.section}
              title="经历与足迹"
              description="按月记录，按当前排列顺序展示。保存会提交完整个人资料并检查版本。"
            >
              <div className={forms.stack}>
                {value.experiences.map((item, index) => (
                  <div className={forms.repeat} key={item.id}>
                    <div className={`${forms.repeatHeader} ${styles.experienceHeader}`}>
                      <strong>经历 {index + 1}</strong>
                      <div className={forms.row}>
                        <Button
                          variant="ghost"
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          上移
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={index === value.experiences.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          下移
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() =>
                            set(
                              "experiences",
                              value.experiences.filter(
                                (row) => row.id !== item.id,
                              ),
                            )
                          }
                        >
                          移除
                        </Button>
                      </div>
                    </div>
                    <div className={`${forms.grid} ${styles.experienceGrid}`}>
                      {(
                        [
                          "title",
                          "organization",
                          "start_date",
                          "end_date",
                          "description",
                        ] as const
                      ).map((key) => (
                        <Field
                          key={key}
                          label={
                            {
                              title: "标题",
                              organization: "组织 / 公司",
                              start_date: "开始月份",
                              end_date: "结束月份（留空表示至今）",
                              description: "经历描述",
                            }[key]
                          }
                        >
                          {key === "description" ? (
                            <textarea
                              value={item.description}
                              maxLength={1000}
                              onChange={(e) =>
                                set(
                                  "experiences",
                                  value.experiences.map((row) =>
                                    row.id === item.id
                                      ? { ...row, [key]: e.target.value }
                                      : row,
                                  ),
                                )
                              }
                            />
                          ) : (
                            <input
                              type={key.includes("date") ? "month" : "text"}
                              value={item[key] || ""}
                              maxLength={key === "title" ? 100 : 120}
                              onChange={(e) =>
                                set(
                                  "experiences",
                                  value.experiences.map((row) =>
                                    row.id === item.id
                                      ? {
                                          ...row,
                                          [key]:
                                            key === "end_date"
                                              ? e.target.value || null
                                              : e.target.value,
                                        }
                                      : row,
                                  ),
                                )
                              }
                            />
                          )}
                        </Field>
                      ))}
                    </div>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  disabled={value.experiences.length >= 30}
                  onClick={() =>
                    set("experiences", [
                      ...value.experiences,
                      {
                        id: crypto.randomUUID(),
                        title: "",
                        organization: "",
                        start_date: new Intl.DateTimeFormat("sv-SE", {
                          timeZone: "Asia/Shanghai",
                          year: "numeric",
                          month: "2-digit",
                        }).format(new Date()),
                        end_date: null,
                        description: "",
                      },
                    ])
                  }
                >
                  ＋ 添加经历
                </Button>
              </div>
            </Panel>
          </>
        ) : (
          <>
            <Panel className={styles.section} title="基本资料" description="介绍你是谁，以及你持续投入的事情。">
              <div className={styles.identityTop}>
                <div className={styles.avatarField} role="group" aria-label="头像">
                <div className={styles.avatar}>
                  <button type="button" className={styles.avatarTrigger} aria-label="选择头像" onClick={() => setPicker(true)}>
                    {value.avatar_media_id ? (
                      <img src={`/api/v1/media/${value.avatar_media_id}`} alt="当前头像预览" />
                    ) : (
                      <span className={styles.avatarPlaceholder} aria-label="未设置头像">{Array.from(value.display_name.trim())[0] || "?"}</span>
                    )}
                    <span className={styles.avatarOverlay} aria-hidden="true">选择头像</span>
                  </button>
                  {value.avatar_media_id && (
                    <button type="button" className={styles.removeAvatar} aria-label="移除头像" title="移除头像" onClick={() => set("avatar_media_id", null)}>
                      <X size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
                </div>
              <div className={styles.identityFields}>
                <Field label="显示名称">
                  <input
                    value={value.display_name}
                    maxLength={80}
                    onChange={(e) => set("display_name", e.target.value)}
                  />
                </Field>
                <Field label="公开地点">
                  <input
                    value={value.location_label || ""}
                    maxLength={100}
                    onChange={(e) =>
                      set("location_label", e.target.value || null)
                    }
                  />
                </Field>
              </div>
              </div>
              <div className={`${forms.stack} ${styles.intro}`}>
                <Field label="职业 / 一句话定位">
                  <input
                    value={value.headline}
                    maxLength={160}
                    onChange={(e) => set("headline", e.target.value)}
                  />
                </Field>
                <Field label="公开邮箱">
                  <input
                    type="email"
                    value={value.public_email || ""}
                    onChange={(e) =>
                      set("public_email", e.target.value || null)
                    }
                  />
                </Field>
                <Field label="GitHub 链接">
                  <input type="url" placeholder="https://github.com/你的用户名" maxLength={2048}
                    value={socialValue("GitHub")} onChange={(e) => setSocial("GitHub", e.target.value)} />
                </Field>
                <Field label="Bilibili 链接">
                  <input type="url" placeholder="https://space.bilibili.com/你的UID" maxLength={2048}
                    value={socialValue("Bilibili")} onChange={(e) => setSocial("Bilibili", e.target.value)} />
                </Field>
              </div>
              <div className={styles.intro}>
                <Field label="简短介绍">
                  <textarea
                    value={value.intro}
                    maxLength={300}
                    onChange={(e) => set("intro", e.target.value)}
                  />
                </Field>
              </div>
              <div className={styles.intro}>
                <Field label="详细介绍" hint="支持 Markdown，右侧实时显示关于我的展示效果。">
                  <textarea className={styles.bio} value={value.bio_markdown} maxLength={20000}
                    onChange={(e) => set("bio_markdown", e.target.value)} />
                </Field>
              </div>
            </Panel>
            <Panel
              className={styles.section}
              title="展示数据"
              description="经验手动维护；作品和笔记自动统计已发布内容。"
            >
              <div className={forms.three}>
                {(["experience", "projects", "notes"] as const).map((key) => (
                  <Field
                    key={key}
                    label={
                      { experience: "经验", projects: "作品", notes: "笔记" }[
                        key
                      ]
                    }
                    hint={key === "experience" ? "手动填写，如 3+" : key === "projects" ? "自动统计已发布项目" : "自动统计已发布技术博客"}
                  >
                    <input
                      maxLength={20}
                      readOnly={key !== "experience"}
                      value={value.stats[key]}
                      onChange={key === "experience" ? (e) =>
                        set("stats", { ...value.stats, experience: e.target.value })
                        : undefined}
                    />
                  </Field>
                ))}
              </div>
            </Panel>
            <Panel className={styles.section} title="技能分组">
              <div className={`${forms.stack} ${styles.skillGroups}`} role="region" aria-label="技术栈分组编辑区" tabIndex={0}>
                {value.skill_groups.map((item, index) => (
                  <SkillGroupEditor key={index} group={item} index={index}
                    onChange={(group) => set("skill_groups", value.skill_groups.map((row, i) => i === index ? group : row))}
                    onRemove={() => set("skill_groups", value.skill_groups.filter((_, i) => i !== index))} />
                ))}
                <Button
                  variant="ghost"
                  disabled={value.skill_groups.length >= 10}
                  onClick={() =>
                    set("skill_groups", [
                      ...value.skill_groups,
                      { title: "", items: [] },
                    ])
                  }
                >
                  ＋ 添加分组
                </Button>
              </div>
            </Panel>

          </>
        )}
      </fieldset>
      {!renderHeading && <div className={forms.actions}>
        <span className={forms.hint}>
          {form.dirty ? "有未保存的修改" : `已保存 · 版本 ${value.version}`}
        </span>
        <Button
          loading={busy}
          disabled={!form.dirty}
          onClick={() => void save()}
        >
          保存{experiences ? "经历" : "个人介绍"}
        </Button>
      </div>}
      </div>
      {renderPreview?.(value, form.dirty)}
      </div>
      {picker && (
        <MediaPicker
          open
          onClose={() => setPicker(false)}
          onSelect={(item) => set("avatar_media_id", item.id)}
        />
      )}
      <UnsavedChangesGuard dirty={form.dirty} />
      <ConflictDialog
        open={conflict}
        onClose={() => setConflict(false)}
        values={value}
        onReload={async () => {
          const { data } = await profileApi.admin();
          form.accept(toInput(data));
          client.setQueryData(["admin", "profile"], data);
          setError(undefined);
        }}
      />
    </div>
  );
}
