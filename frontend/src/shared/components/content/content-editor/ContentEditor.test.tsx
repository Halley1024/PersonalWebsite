// @vitest-environment jsdom
import { useState } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TaxonomyRow } from "../../../api/taxonomy";
import { taxonomyApi } from "../../../api/taxonomy";
import { ContentEditor } from "./ContentEditor";
import { emptyContent, type ContentDraft } from "./types";
import { createContentSchema } from "../../../schemas/content";
vi.mock("../../media/media-picker/MediaPicker", () => ({ MediaPicker: ({ onSelect, onClose }: { onSelect: (item: { id: string; alt: string }) => void; onClose: () => void }) => <button onClick={() => { onSelect({ id: "a0000000-0000-4000-8000-000000000001", alt: "上传的媒体描述" }); onClose(); }}>使用测试封面</button> }));
const clients: QueryClient[] = [];
const show = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterAll(() => { if (show) Object.defineProperty(HTMLDialogElement.prototype, "showModal", show); else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal"); if (close) Object.defineProperty(HTMLDialogElement.prototype, "close", close); else Reflect.deleteProperty(HTMLDialogElement.prototype, "close"); });
afterEach(() => { cleanup(); clients.forEach((client) => client.clear()); clients.length = 0; vi.restoreAllMocks(); });
function taxonomy(index: number, name: string, category = false): TaxonomyRow {
  return { id: `b0000000-0000-4000-8000-${String(index).padStart(12,"0")}`, name, content_count: 0, slug: `taxonomy-${index}`, kind: "blog", version: 1, created_at: "2026-11-02T00:00:00Z", updated_at: "2026-11-02T00:00:00Z", ...(category ? { sort_order: 0 } : {}) };
}
async function setup(initial: Partial<ContentDraft> = {}, count = 3) {
  const categories = [taxonomy(101, "开发笔记", true), taxonomy(102, "工程实践", true)];
  const tags = Array.from({ length: count }, (_, i) => taxonomy(i + 1, `标签${i + 1}`));
  const list = vi.spyOn(taxonomyApi, "list").mockImplementation(async (type) => ({ data: type === "categories" ? categories : tags, meta: { page: 1, page_size: 100, total: type === "categories" ? categories.length : tags.length, total_pages: 1 } }));
  const create = vi.spyOn(taxonomyApi, "create").mockImplementation(async (type, body) => {
    const row = { ...taxonomy(type === "categories" ? 103 : count + 1, body.name, type === "categories"), slug: body.slug };
    (type === "categories" ? categories : tags).push(row);
    return { data: row };
  });
  function Editor() {
    const [value, setValue] = useState<ContentDraft>({ ...emptyContent("blog"), ...initial });
    return <><ContentEditor value={value} editing={false} onChange={setValue} /><output aria-label="当前草稿">{JSON.stringify(value)}</output></>;
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } }); clients.push(client);
  render(<QueryClientProvider client={client}><Editor /></QueryClientProvider>);
  await screen.findByRole("button", { name: "开发笔记" });
  return { list, create, categories, tags, draft: () => JSON.parse(screen.getByLabelText("当前草稿").textContent!) as ContentDraft };
}
describe("文章封面及分类标签", () => {
  it("无封面占位始终可见，可上传、编辑独立封面描述及图标移除", async () => {
    const { draft } = await setup();
    expect(screen.getByText("给内容一个视觉入口")).toBeTruthy();
    expect(screen.getByLabelText("封面描述").tagName).toBe("TEXTAREA");
    expect(screen.queryByRole("button", { name: "移除封面" })).toBeNull();
    fireEvent.change(screen.getByLabelText("封面描述"), { target: { value: "文章独立描述" } });
    fireEvent.click(screen.getByRole("button", { name: "上传封面" }));
    fireEvent.click(screen.getByRole("button", { name: "使用测试封面" }));
    expect(draft().cover_alt).toBe("文章独立描述");
    expect(screen.getByRole("img", { name: "文章独立描述" })).toBeTruthy();
    const payload = createContentSchema.parse({ ...draft(), title: "标题", excerpt: "摘要", slug: "test" });
    expect(payload.cover_alt).toBe("文章独立描述");
    fireEvent.click(screen.getByRole("button", { name: "移除封面" }));
    expect(draft().cover_media_id).toBeNull();
    expect(draft().cover_alt).toBe("");
    expect(screen.getByText("给内容一个视觉入口")).toBeTruthy();
  });
  it("分类与标签直接展示全部选项，不使用下拉框，分类标签均可多选", async () => {
    const { draft, categories, tags, list } = await setup();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: "不设置分类" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "开发笔记" }));
    fireEvent.click(screen.getByRole("button", { name: "工程实践" }));
    expect(draft().category_ids).toEqual(categories.map((category) => category.id));
    expect(createContentSchema.parse({ ...draft(), title: "标题", excerpt: "摘要", slug: "test" }).category_ids).toEqual(categories.map((category) => category.id));
    expect(screen.getByRole("button", { name: "工程实践" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "工程实践" }));
    expect(draft().category_ids).toEqual([categories[0].id]);
    expect(screen.getByRole("button", { name: "开发笔记" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "工程实践" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "标签1" }));
    fireEvent.click(screen.getByRole("button", { name: "标签2" }));
    expect(draft().tag_ids).toEqual([tags[0].id, tags[1].id]);
    fireEvent.click(screen.getByRole("button", { name: "标签1" }));
    expect(draft().tag_ids).toEqual([tags[1].id]);
    fireEvent.click(screen.getByRole("button", { name: "开发笔记" }));
    expect(draft().category_ids).toEqual([]);
    const cleared = createContentSchema.parse({ ...draft(), title: "标题", excerpt: "摘要", slug: "test" });
    expect(cleared.category_ids).toEqual([]);
    expect(cleared.category_id).toBeNull();
    expect(list).toHaveBeenCalledWith("categories", { kind: "blog", page: 1, page_size: 100 }, expect.anything());
  });
  it("新增分类弹窗创建当前类型，成功后自动选择；新增标签亦可直接选中", async () => {
    const { create, draft, categories } = await setup();
    fireEvent.click(screen.getByRole("button", { name: "开发笔记" }));
    for (const [type, name, slug] of [["分类", "新分类", "new-category"], ["标签", "新标签", "new-tag"]]) {
      fireEvent.click(screen.getByRole("button", { name: `＋ 新增${type}` }));
      const dialog = screen.getByRole("dialog", { name: `新增${type}` });
      fireEvent.change(within(dialog).getByLabelText("名称"), { target: { value: name } });
      fireEvent.change(within(dialog).getByLabelText("slug"), { target: { value: slug } });
      fireEvent.click(within(dialog).getByRole("button", { name: "保存" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { name: `新增${type}` })).toBeNull());
      expect((await screen.findByRole("button", { name })).getAttribute("aria-pressed")).toBe("true");
    }
    expect(create).toHaveBeenCalledWith("categories", { name: "新分类", slug: "new-category", sort_order: 0, kind: "blog" });
    expect(create).toHaveBeenCalledWith("tags", { name: "新标签", slug: "new-tag", kind: "blog" });
    expect(draft().category_ids).toEqual([categories[0].id, categories[2].id]); expect(draft().tag_ids).toHaveLength(1);
  });
  it("标签达到10个时禁止继续选择，取消一个后可选新标签", async () => {
    const selected = Array.from({ length: 10 }, (_, i) => taxonomy(i + 1, "").id);
    const { draft } = await setup({ tag_ids: selected }, 11);
    const extra = screen.getByRole("button", { name: "标签11" }) as HTMLButtonElement;
    expect(extra.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "标签1" }));
    expect(extra.disabled).toBe(false); fireEvent.click(extra);
    expect(draft().tag_ids).toHaveLength(10);
  });
  it("作品和生活日期沿用完整日期数据，使用新日历选择和清除结束日期", async () => {
    const { draft } = await setup({ ...emptyContent("project"), project: { ...emptyContent("project").project!, started_on: "2024-01-31" } });
    fireEvent.click(screen.getByRole("button", { name: "开始日期" }));
    fireEvent.click(screen.getByRole("button", { name: "下一年" }));
    fireEvent.click(screen.getByRole("button", { name: "2025-01-15" }));
    expect(draft().project?.started_on).toBe("2025-01-15");
    fireEvent.click(screen.getByRole("button", { name: "结束日期" }));
    fireEvent.click(screen.getByRole("button", { name: /输入年月，当前/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "年份" }), { target: { value: "2025" } });
    fireEvent.change(screen.getByRole("textbox", { name: "月份" }), { target: { value: "1" } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "月份" }), { key: "Enter" });
    expect((screen.getByRole("button", { name: "2025-01-14" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "2025-01-20" }));
    expect(draft().project?.ended_on).toBe("2025-01-20");
    fireEvent.click(screen.getByRole("button", { name: "结束日期" }));
    fireEvent.click(screen.getByRole("button", { name: "清除日期" }));
    expect(draft().project?.ended_on).toBeNull();
    const payload = createContentSchema.parse({ ...draft(), title: "作品", excerpt: "摘要", slug: "project" });
    expect(payload.project?.started_on).toBe("2025-01-15");
  });
  it("生活记录日期可以输入年月跳转并选择具体日期", async () => {
    const { draft } = await setup({ ...emptyContent("life") });
    fireEvent.click(screen.getByRole("button", { name: "发生日期" }));
    fireEvent.click(screen.getByRole("button", { name: /输入年月，当前/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "年份" }), { target: { value: "2024" } });
    fireEvent.change(screen.getByRole("textbox", { name: "月份" }), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "跳转" }));
    fireEvent.click(screen.getByRole("button", { name: "2024-02-29" }));
    expect(draft().life?.occurred_on).toBe("2024-02-29");
  });
  it("新增失败保留弹窗输入与已有文章字段", async () => {
    const { create, draft } = await setup({ title: "保留文章标题" });
    create.mockRejectedValueOnce(new Error("创建失败"));
    fireEvent.click(screen.getByRole("button", { name: "＋ 新增标签" }));
    const dialog = screen.getByRole("dialog", { name: "新增标签" });
    fireEvent.change(within(dialog).getByLabelText("名称"), { target: { value: "失败标签" } });
    fireEvent.change(within(dialog).getByLabelText("slug"), { target: { value: "failed-tag" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存" }));
    await within(dialog).findByRole("alert");
    expect((within(dialog).getByLabelText("名称") as HTMLInputElement).value).toBe("失败标签");
    expect(draft().title).toBe("保留文章标题");
  });
});
