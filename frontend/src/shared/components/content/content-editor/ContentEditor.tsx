import type { ContentDraft } from "./types";
import { DatePicker } from "../../ui/date-picker/DatePicker";
import { Field } from "../../ui/field/Field";
import { Panel } from "../../ui/panel/Panel";
import { MarkdownEditor } from "../markdown-editor/MarkdownEditor";
import forms from "../../../styles/forms.module.css";
import styles from "./ContentEditor.module.css";
import { ContentCover } from "./ContentCover";
import { ContentTaxonomy } from "./ContentTaxonomy";
export function ContentEditor({
  value,
  onChange,
  editing,
  disabled,
}: {
  value: ContentDraft;
  onChange: (value: ContentDraft) => void;
  editing: boolean;
  disabled?: boolean;
}) {
  const set = <K extends keyof ContentDraft>(key: K, v: ContentDraft[K]) =>
    onChange({ ...value, [key]: v });
  return (
    <fieldset disabled={disabled} className={styles.editor}>
      <div className={styles.main}>
        <Panel title="内容信息">
          <div className={forms.stack}>
            <Field label="标题">
              <input
                value={value.title}
                maxLength={120}
                onChange={(e) => set("title", e.target.value)}
              />
            </Field>
            <Field
              label="固定链接 slug"
              hint={
                editing
                  ? "创建后不可修改"
                  : "小写英文、数字及连字符，例如 rust-error-handling"
              }
            >
              <input
                value={value.slug}
                disabled={editing}
                maxLength={100}
                onChange={(e) => set("slug", e.target.value)}
              />
            </Field>
            <Field label="摘要">
              <textarea
                value={value.excerpt}
                maxLength={300}
                onChange={(e) => set("excerpt", e.target.value)}
              />
            </Field>
          </div>
        </Panel>
        <Panel
          title="正文"
          description="Markdown 编辑，支持 GFM；草稿可暂不填写正文。"
        >
          <MarkdownEditor
            value={value.body_markdown}
            onChange={(v) => set("body_markdown", v)}
          />
        </Panel>
        {value.project && (
          <Panel title="作品信息">
            <div className={forms.grid}>
              <Field label="项目阶段">
                <select
                  value={value.project.project_stage}
                  onChange={(e) =>
                    set("project", {
                      ...value.project!,
                      project_stage: e.target.value as NonNullable<
                        ContentDraft["project"]
                      >["project_stage"],
                    })
                  }
                >
                  <option value="idea">构想中</option>
                  <option value="building">构建中</option>
                  <option value="maintained">持续维护</option>
                  <option value="completed">已完成</option>
                </select>
              </Field>
              <Field label="技术栈" hint="用英文逗号分隔">
                <input
                  value={value.project.tech_stack.join(",")}
                  onChange={(e) =>
                    set("project", {
                      ...value.project!,
                      tech_stack: e.target.value
                        ? e.target.value.split(",")
                        : [],
                    })
                  }
                />
              </Field>
              <Field label="开始日期">
                <DatePicker
                  label="开始日期"
                  value={value.project.started_on}
                  onChange={(day) =>
                    set("project", {
                      ...value.project!,
                      started_on: day,
                    })
                  }
                />
              </Field>
              <Field label="结束日期" hint="留空表示至今">
                <DatePicker
                  label="结束日期"
                  value={value.project.ended_on || ""}
                  min={value.project.started_on || undefined}
                  clearable
                  onChange={(day) =>
                    set("project", {
                      ...value.project!,
                      ended_on: day || null,
                    })
                  }
                />
              </Field>
              <Field label="仓库 URL">
                <input
                  type="url"
                  placeholder="https://"
                  value={value.project.repository_url || ""}
                  onChange={(e) =>
                    set("project", {
                      ...value.project!,
                      repository_url: e.target.value || null,
                    })
                  }
                />
              </Field>
              <Field label="演示 URL">
                <input
                  type="url"
                  placeholder="https://"
                  value={value.project.demo_url || ""}
                  onChange={(e) =>
                    set("project", {
                      ...value.project!,
                      demo_url: e.target.value || null,
                    })
                  }
                />
              </Field>
            </div>
          </Panel>
        )}
        {value.life && (
          <Panel title="生活记录">
            <div className={forms.grid}>
              <Field label="发生日期">
                <DatePicker
                  label="发生日期"
                  value={value.life.occurred_on}
                  onChange={(day) =>
                    set("life", { ...value.life!, occurred_on: day })
                  }
                />
              </Field>
              <Field label="地点（可选）">
                <input
                  maxLength={100}
                  placeholder="仅填写愿意公开的模糊地点"
                  value={value.life.location_label || ""}
                  onChange={(e) =>
                    set("life", {
                      ...value.life!,
                      location_label: e.target.value || null,
                    })
                  }
                />
              </Field>
            </div>
          </Panel>
        )}
      </div>
      <aside className={styles.aside}>
        <Panel title="文章封面">
          <ContentCover mediaId={value.cover_media_id} alt={value.cover_alt || ""} onChange={(patch) => onChange({ ...value, ...patch })} />
        </Panel>
        <Panel title="分类与标签">
          <ContentTaxonomy kind={value.kind} categoryIds={value.category_ids ?? (value.category_id ? [value.category_id] : [])} tagIds={value.tag_ids} onChange={(patch) => onChange({ ...value, ...patch })} />
        </Panel>
        <Panel title="展示与 SEO">
          <div className={forms.stack}>
            <label className={forms.checkbox}>
              <input
                type="checkbox"
                checked={value.featured}
                onChange={(e) => set("featured", e.target.checked)}
              />
              首页精选
            </label>
            <Field label="排序值" hint="作品排序值越小越靠前">
              <input
                type="number"
                value={value.sort_order}
                onChange={(e) => set("sort_order", Number(e.target.value))}
              />
            </Field>
            <Field label="SEO 标题（可选）">
              <input
                maxLength={70}
                value={value.seo_title || ""}
                onChange={(e) => set("seo_title", e.target.value || null)}
              />
            </Field>
            <Field label="SEO 描述（可选）">
              <textarea
                maxLength={160}
                value={value.seo_description || ""}
                onChange={(e) => set("seo_description", e.target.value || null)}
              />
            </Field>
          </div>
        </Panel>
      </aside>
    </fieldset>
  );
}
