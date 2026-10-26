import { useUpdateProfile } from "../../../queries/profile";
import { useState } from "react";
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
import { MarkdownEditor } from "../../content/markdown-editor/MarkdownEditor";
import { UnsavedChangesGuard } from "../../feedback/unsaved-changes-guard/UnsavedChangesGuard";
import { ConflictDialog } from "../../feedback/conflict-dialog/ConflictDialog";
import { ExperienceTimeline } from "../experience-timeline/ExperienceTimeline";
import forms from "../../../styles/forms.module.css";
import styles from "./ProfileEditor.module.css";
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
}: {
  initial: AdminProfile;
  experiences?: boolean;
}) {
  const form = useEditorState(
    `profile:${experiences ? "experiences" : "details"}`,
    toInput(initial),
  );
  const value = form.value;
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);
  const [conflict, setConflict] = useState(false);
  const client = useQueryClient();
  const mutation = useUpdateProfile();
  const toast = useToast();
  const set = <K extends keyof ProfileUpdate>(key: K, v: ProfileUpdate[K]) =>
    form.setValue({ ...value, [key]: v });
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
      <ErrorNotice error={error} />
      <fieldset disabled={busy} className={forms.stack}>
        {experiences ? (
          <>
            <Panel
              title="经历与足迹"
              description="按月记录，按当前排列顺序展示。保存会提交完整个人资料并检查版本。"
            >
              <div className={forms.stack}>
                {value.experiences.map((item, index) => (
                  <div className={forms.repeat} key={item.id}>
                    <div className={forms.repeatHeader}>
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
                    <div className={forms.grid}>
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
            <Panel title="时间线预览">
              <ExperienceTimeline items={value.experiences} />
            </Panel>
          </>
        ) : (
          <>
            <Panel title="基础介绍">
              <div className={forms.grid}>
                <Field label="显示名称">
                  <input
                    value={value.display_name}
                    maxLength={80}
                    onChange={(e) => set("display_name", e.target.value)}
                  />
                </Field>
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
              <div className={styles.intro}>
                <Field label="简短介绍">
                  <textarea
                    value={value.intro}
                    maxLength={300}
                    onChange={(e) => set("intro", e.target.value)}
                  />
                </Field>
              </div>
              <div className={styles.avatar}>
                {value.avatar_media_id && (
                  <img
                    src={`/api/v1/media/${value.avatar_media_id}`}
                    alt="当前头像预览"
                  />
                )}
                <Button variant="ghost" onClick={() => setPicker(true)}>
                  选择头像
                </Button>
                {value.avatar_media_id && (
                  <Button
                    variant="danger"
                    onClick={() => set("avatar_media_id", null)}
                  >
                    移除
                  </Button>
                )}
              </div>
            </Panel>
            <Panel
              title="首页展示数字"
              description="这些是手动维护的展示文字，不是自动统计。"
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
                  >
                    <input
                      maxLength={20}
                      value={value.stats[key]}
                      onChange={(e) =>
                        set("stats", { ...value.stats, [key]: e.target.value })
                      }
                    />
                  </Field>
                ))}
              </div>
            </Panel>
            <Panel title="完整个人介绍">
              <MarkdownEditor
                images={false}
                value={value.bio_markdown}
                onChange={(v) => set("bio_markdown", v)}
              />
            </Panel>
            <Panel title="社交链接">
              <div className={forms.stack}>
                {value.social_links.map((item, index) => (
                  <div className={forms.repeat} key={index}>
                    <div className={forms.grid}>
                      <Field label="名称">
                        <input
                          maxLength={40}
                          value={item.label}
                          onChange={(e) =>
                            set(
                              "social_links",
                              value.social_links.map((row, i) =>
                                i === index
                                  ? { ...row, label: e.target.value }
                                  : row,
                              ),
                            )
                          }
                        />
                      </Field>
                      <Field label="HTTPS / mailto 链接">
                        <input
                          value={item.url}
                          onChange={(e) =>
                            set(
                              "social_links",
                              value.social_links.map((row, i) =>
                                i === index
                                  ? { ...row, url: e.target.value }
                                  : row,
                              ),
                            )
                          }
                        />
                      </Field>
                    </div>
                    <Button
                      variant="danger"
                      onClick={() =>
                        set(
                          "social_links",
                          value.social_links.filter((_, i) => i !== index),
                        )
                      }
                    >
                      移除链接
                    </Button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  disabled={value.social_links.length >= 10}
                  onClick={() =>
                    set("social_links", [
                      ...value.social_links,
                      { label: "", url: "" },
                    ])
                  }
                >
                  ＋ 添加链接
                </Button>
              </div>
            </Panel>
            <Panel title="技能分组">
              <div className={forms.stack}>
                {value.skill_groups.map((item, index) => (
                  <div className={forms.repeat} key={index}>
                    <Field label="分组名称">
                      <input
                        maxLength={50}
                        value={item.title}
                        onChange={(e) =>
                          set(
                            "skill_groups",
                            value.skill_groups.map((row, i) =>
                              i === index
                                ? { ...row, title: e.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="技能项目" hint="用英文逗号分隔">
                      <input
                        value={item.items.join(",")}
                        onChange={(e) =>
                          set(
                            "skill_groups",
                            value.skill_groups.map((row, i) =>
                              i === index
                                ? {
                                    ...row,
                                    items: e.target.value
                                      ? e.target.value.split(",")
                                      : [],
                                  }
                                : row,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Button
                      variant="danger"
                      onClick={() =>
                        set(
                          "skill_groups",
                          value.skill_groups.filter((_, i) => i !== index),
                        )
                      }
                    >
                      移除分组
                    </Button>
                  </div>
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
      <div className={forms.actions}>
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
