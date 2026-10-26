import { useState } from "react";
import type { ContentDraft } from "./types";
import { useTaxonomyOptions } from "../../../queries/taxonomy";
import { Field } from "../../ui/field/Field";
import { Panel } from "../../ui/panel/Panel";
import { Button } from "../../ui/button/Button";
import { MarkdownEditor } from "../markdown-editor/MarkdownEditor";
import { MediaPicker } from "../../media/media-picker/MediaPicker";
import { GalleryEditor } from "../../media/gallery-editor/GalleryEditor";
import forms from "../../../styles/forms.module.css";
import styles from "./ContentEditor.module.css";
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
  const categories = useTaxonomyOptions("categories", value.kind);
  const tags = useTaxonomyOptions("tags", value.kind);
  const [cover, setCover] = useState(false);
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
                <input
                  type="date"
                  value={value.project.started_on}
                  onChange={(e) =>
                    set("project", {
                      ...value.project!,
                      started_on: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="结束日期" hint="留空表示至今">
                <input
                  type="date"
                  value={value.project.ended_on || ""}
                  onChange={(e) =>
                    set("project", {
                      ...value.project!,
                      ended_on: e.target.value || null,
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
                <input
                  type="date"
                  value={value.life.occurred_on}
                  onChange={(e) =>
                    set("life", { ...value.life!, occurred_on: e.target.value })
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
        {value.kind !== "blog" && (
          <Panel title="内容相册">
            <GalleryEditor
              value={value.gallery}
              onChange={(v) => set("gallery", v)}
            />
          </Panel>
        )}
      </div>
      <aside className={styles.aside}>
        <Panel title="封面图片">
          {value.cover_media_id ? (
            <>
              <img
                className={styles.cover}
                src={`/api/v1/media/${value.cover_media_id}`}
                alt="当前封面预览"
              />
              <div className={forms.row}>
                <Button variant="ghost" onClick={() => setCover(true)}>
                  替换封面
                </Button>
                <Button
                  variant="danger"
                  onClick={() => set("cover_media_id", null)}
                >
                  移除
                </Button>
              </div>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setCover(true)}>
              选择封面
            </Button>
          )}
          <p className={forms.hint}>替代文本使用媒体上传时的描述。</p>
        </Panel>
        <Panel title="分类与标签">
          <div className={forms.stack}>
            <Field label="分类">
              <select
                value={value.category_id || ""}
                onChange={(e) => set("category_id", e.target.value || null)}
              >
                <option value="">不设置分类</option>
                {categories.data?.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className={styles.tags}>
              <span>标签（最多 10 个）</span>
              {tags.data?.map((tag) => (
                <label key={tag.id}>
                  <input
                    type="checkbox"
                    checked={value.tag_ids.includes(tag.id)}
                    disabled={
                      !value.tag_ids.includes(tag.id) &&
                      value.tag_ids.length >= 10
                    }
                    onChange={(e) =>
                      set(
                        "tag_ids",
                        e.target.checked
                          ? [...value.tag_ids, tag.id]
                          : value.tag_ids.filter((id) => id !== tag.id),
                      )
                    }
                  />
                  {tag.name}
                </label>
              ))}
              {!tags.data?.length && (
                <small>请先在分类与标签页创建标签。</small>
              )}
            </div>
            {(categories.isError || tags.isError) && (
              <p role="alert">分类标签加载失败，请刷新页面重试。</p>
            )}
          </div>
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
      {cover && (
        <MediaPicker
          open
          onClose={() => setCover(false)}
          onSelect={(item) => set("cover_media_id", item.id)}
        />
      )}
    </fieldset>
  );
}
