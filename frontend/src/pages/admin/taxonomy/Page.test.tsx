// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { taxonomyApi, type TaxonomyRow } from "../../../shared/api/taxonomy";
import { contentApi } from "../../../shared/api/content";
import type { AdminCard } from "../../../shared/api/generated";
import Page from "./Page";
vi.mock("../../../shared/hooks/useSeo", () => ({ useSeo: () => {} }));
const clients: QueryClient[] = [];
const show = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterAll(() => {
  if (show) Object.defineProperty(HTMLDialogElement.prototype, "showModal", show); else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (close) Object.defineProperty(HTMLDialogElement.prototype, "close", close); else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});
afterEach(() => { cleanup(); clients.forEach((client) => client.clear()); clients.length = 0; vi.restoreAllMocks(); });
const row = (id: string, name: string, count: number, kind = "blog", category = true): TaxonomyRow => ({ id, name, slug: id, content_count: count, kind: kind as TaxonomyRow["kind"], version: 1, created_at: "2026-11-02T00:00:00Z", updated_at: "2026-11-02T00:00:00Z", ...(category ? { sort_order: 0 } : {}) });
const article: AdminCard = { id: "post-1", kind: "blog", status: "draft", title: "绑定的文章", slug: "post-1", excerpt: "与内容管理一致的简介", cover: null, category: null, tags: [], featured: false, published_at: null, updated_at: "2026-11-02T00:00:00Z", created_at: "2026-11-02T00:00:00Z", version: 3, sort_order: 0, project: null, life: null };
async function setup(path = "/admin/taxonomy") {
  const taxonomy = vi.spyOn(taxonomyApi, "list").mockImplementation(async (type, params) => ({
    data: type === "categories" ? [row("rust", "Rust 分类", 17, params.kind), row("empty", "空分类", 0, params.kind)] : [row("rust-tag", "Rust 标签", 9, params.kind, false)],
    meta: { page: params.page || 1, page_size: 50, total: type === "categories" ? 60 : 1, total_pages: type === "categories" && params.page_size !== 100 ? 2 : 1 },
  }));
  const list = vi.spyOn(contentApi, "adminList").mockImplementation(async (filters = {}) => ({ data: filters.category === "empty" ? [] : [{ ...article, kind: filters.kind || "blog" }], meta: { page: filters.page || 1, page_size: 8, total: filters.category === "empty" ? 0 : 17, total_pages: filters.category === "empty" ? 0 : 3 } }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } }); clients.push(client);
  const router = createMemoryRouter([{ path: "/admin/taxonomy", element: <Page /> }], { initialEntries: [path] });
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);
  await screen.findByRole("button", { name: "Rust 分类" });
  return { taxonomy, list, router };
}
describe("分类与标签关联内容管理", () => {
  it("显示真实关联数量，点击才请求该目录内容，编辑按钮不会误触展开", async () => {
    const { list } = await setup();
    expect(list).not.toHaveBeenCalled();
    const directoryRow = screen.getByRole("button", { name: "Rust 分类" }).closest("tr")!;
    expect(within(directoryRow).getByText("17")).toBeTruthy();
    fireEvent.click(within(directoryRow).getByRole("button", { name: "编辑" }));
    const dialog = screen.getByRole("dialog", { name: "编辑分类" });
    expect(list).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
    fireEvent.click(within(directoryRow).getByRole("button", { name: /查看Rust 分类的关联内容/ }));
    const related = screen.getByRole("region", { name: "Rust 分类关联内容" });
    expect(await within(related).findByRole("link", { name: "绑定的文章" })).toBeTruthy();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "blog", category: "rust", page: 1, page_size: 8 }), expect.anything());
    expect(within(related).getByRole("columnheader", { name: "文章 / 简介" })).toBeTruthy();
    expect(within(related).getByText("与内容管理一致的简介")).toBeTruthy();
    expect(within(related).getByRole("button", { name: "修改" })).toBeTruthy();
    expect(within(related).getByRole("button", { name: "清除" })).toBeTruthy();
    expect(within(related).queryByRole("button", { name: "发布" })).toBeNull();
    expect(within(related).queryByRole("link", { name: "编辑" })).toBeNull();
  });
  it("关联内容分页和筛选保留分类，不影响目录分页；切换条目重置内容筛选", async () => {
    const { list, router } = await setup("/admin/taxonomy?page=2");
    fireEvent.click(screen.getByRole("button", { name: "Rust 分类" }));
    const related = screen.getByRole("region", { name: "Rust 分类关联内容" });
    await within(related).findByRole("link", { name: "绑定的文章" });
    fireEvent.change(within(related).getByRole("searchbox", { name: "搜索内容" }), { target: { value: "rust" } });
    fireEvent.click(await within(related).findByRole("button", { name: "第 2 页" }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ category: "rust", page: 2, q: "rust" }), expect.anything()));
    expect(router.state.location.search).toContain("page=2");
    fireEvent.change(within(related).getByRole("combobox", { name: "内容状态" }), { target: { value: "draft" } });
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ category: "rust", page: 1, q: "rust", status: "draft" }), expect.anything()));
    expect(new URLSearchParams(router.state.location.search).get("page")).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "空分类" }));
    await screen.findByText("还没有匹配的内容，试试其他关键词或清除当前筛选。");
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ category: "empty", page: 1, q: "", status: undefined }), expect.anything());
    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    expect(screen.getByRole("region", { name: "空分类关联内容" })).toBeTruthy();
  });
  it("切换分类或标签及内容类型后清除旧选择，标签筛选不会混入分类", async () => {
    const { list } = await setup();
    fireEvent.click(screen.getByRole("button", { name: "Rust 分类" }));
    await screen.findByRole("link", { name: "绑定的文章" });
    fireEvent.click(within(screen.getByRole("group", { name: "目录类型" })).getByRole("button", { name: "标签" }));
    fireEvent.click(await screen.findByRole("button", { name: "Rust 标签" }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ tag: "rust-tag", kind: "blog", page: 1 }), expect.anything()));
    expect(list.mock.calls.at(-1)?.[0]?.category).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "项目作品" }));
    await screen.findByRole("button", { name: "Rust 标签" });
    expect(screen.queryByRole("region", { name: "Rust 标签关联内容" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Rust 标签" }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ tag: "rust-tag", kind: "project", page: 1 }), expect.anything()));
  });
  it("预览仍查看文章，清除仅移除当前分类并刷新计数，保留其他分类和标签", async () => {
    const { taxonomy } = await setup();
    const detail = { ...article, body_markdown: "关联草稿正文", cover_media_id: null, category_id: "rust", category_ids: ["rust", "other"], tag_ids: ["tag-1"], seo_title: null, seo_description: null, gallery: [] };
    vi.spyOn(contentApi, "adminDetail").mockResolvedValue({ data: detail });
    const update = vi.spyOn(contentApi, "taxonomy").mockResolvedValue({ data: detail });
    const remove = vi.spyOn(contentApi, "remove");
    const status = vi.spyOn(contentApi, "status");
    fireEvent.click(screen.getByRole("button", { name: "Rust 分类" }));
    await screen.findByRole("link", { name: "绑定的文章" });
    fireEvent.click(screen.getByRole("button", { name: "预览" }));
    const preview = screen.getByRole("dialog", { name: "内容预览" });
    await within(preview).findByText("关联草稿正文");
    fireEvent.click(within(preview).getByRole("button", { name: "关闭弹窗" }));
    const calls = taxonomy.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "清除" }));
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog", { name: "清除文章分类绑定" })).getByRole("button", { name: "清除" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("post-1", { version: 3, category_ids: ["other"], tag_ids: ["tag-1"] }));
    await waitFor(() => expect(taxonomy.mock.calls.length).toBeGreaterThan(calls));
    expect(remove).not.toHaveBeenCalled(); expect(status).not.toHaveBeenCalled();
  });
  it("修改只调整分类多选，标签保持原值，保存失败可重试", async () => {
    await setup();
    const detail = { ...article, body_markdown: "正文保留", cover_media_id: null, category_id: "rust", category_ids: ["rust"], tag_ids: ["tag-1"], seo_title: null, seo_description: null, gallery: [] };
    vi.spyOn(contentApi, "adminDetail").mockResolvedValue({ data: detail });
    const update = vi.spyOn(contentApi, "taxonomy").mockRejectedValueOnce(new Error("保存失败")).mockResolvedValue({ data: detail });
    fireEvent.click(screen.getByRole("button", { name: "Rust 分类" }));
    await screen.findByRole("link", { name: "绑定的文章" });
    fireEvent.click(screen.getByRole("button", { name: "修改" }));
    const dialog = screen.getByRole("dialog", { name: "修改文章分类" });
    fireEvent.click(await within(dialog).findByRole("checkbox", { name: "空分类" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "保存修改" }));
    await within(dialog).findByRole("alert");
    expect(within(dialog).getByRole("checkbox", { name: "空分类" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(within(dialog).getByRole("button", { name: "保存修改" }));
    await waitFor(() => expect(update).toHaveBeenLastCalledWith("post-1", { version: 3, category_ids: ["rust", "empty"], tag_ids: ["tag-1"] }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "修改文章分类" })).toBeNull());
  });
  it("清除标签时保留其他标签及全部分类", async () => {
    await setup();
    const detail = { ...article, body_markdown: "正文", cover_media_id: null, category_id: "rust", category_ids: ["rust", "other"], tag_ids: ["rust-tag", "other-tag"], seo_title: null, seo_description: null, gallery: [] };
    vi.spyOn(contentApi, "adminDetail").mockResolvedValue({ data: detail });
    const update = vi.spyOn(contentApi, "taxonomy").mockResolvedValue({ data: detail });
    fireEvent.click(within(screen.getByRole("group", { name: "目录类型" })).getByRole("button", { name: "标签" }));
    fireEvent.click(await screen.findByRole("button", { name: "Rust 标签" }));
    await screen.findByRole("button", { name: "清除" });
    fireEvent.click(screen.getByRole("button", { name: "清除" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "清除文章标签绑定" })).getByRole("button", { name: "清除" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("post-1", { version: 3, category_ids: ["rust", "other"], tag_ids: ["other-tag"] }));
  });
});
