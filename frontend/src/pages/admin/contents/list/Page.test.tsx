// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AdminCard, AdminDetail } from "../../../../shared/api/generated";
import { contentApi } from "../../../../shared/api/content";
import { dashboardApi } from "../../../../shared/api/dashboard";
import Page from "./Page";
vi.mock("../../../../shared/hooks/useSeo", () => ({ useSeo: () => {} }));
function card(id: string, kind: AdminCard["kind"], status: AdminCard["status"], title: string): AdminCard {
  return { id, kind, status, title, slug: id, excerpt: "参考列表简介", cover: null, category: null, tags: [], featured: false, published_at: status === "published" ? "2026-10-01T00:00:00Z" : null, updated_at: "2026-11-02T00:00:00Z", created_at: "2026-10-01T00:00:00Z", version: 7, sort_order: 0,
    project: kind === "project" ? { tech_stack: [], project_stage: "building", started_on: "2024-01-01", ended_on: null, repository_url: null, demo_url: null } : null,
    life: kind === "life" ? { occurred_on: "2026-10-10", location_label: "测试地点" } : null };
}
const rows = [card("blog-1", "blog", "published", "Rust 笔记"), card("project-1", "project", "draft", "示例项目"), card("life-1", "life", "archived", "生活记录标题")];
const detail: AdminDetail = { ...rows[1], body_markdown: "## 预览正文\n\n后台草稿正文。", cover_media_id: null, category_id: null, tag_ids: [], seo_title: null, seo_description: null, gallery: [] };
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
async function setup(path = "/admin/contents", empty = false) {
  const list = vi.spyOn(contentApi, "adminList").mockResolvedValue({ data: empty ? [] : rows, meta: { page: 1, page_size: 8, total: empty ? 0 : 20, total_pages: empty ? 0 : 3 } });
  vi.spyOn(dashboardApi, "get").mockResolvedValue({ data: { counts: [
    { kind: "blog", status: "published", count: 20 }, { kind: "blog", status: "draft", count: 2 }, { kind: "blog", status: "archived", count: 1 },
    { kind: "project", status: "published", count: 4 }, { kind: "project", status: "draft", count: 1 },
    { kind: "life", status: "published", count: 3 }, { kind: "life", status: "draft", count: 1 },
  ], recent_contents: [] } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } }); clients.push(client);
  const router = createMemoryRouter([{ path: "/admin/contents", element: <Page /> }], { initialEntries: [path] });
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);
  await waitFor(() => expect(list).toHaveBeenCalled());
  await waitFor(() => expect(within(screen.getByRole("group", { name: "内容类型筛选" })).getByText("32")).toBeTruthy());
  if (!empty) await screen.findByRole("link", { name: "Rust 笔记" });
  return { list, router };
}
describe("内容管理参考界面", () => {
  it("状态卡统计完整内容，类型计数不受当前页与筛选影响", async () => {
    const { list } = await setup("/admin/contents?page=2&q=rust&status=draft");
    expect(within(screen.getByLabelText("内容状态统计")).getByText("27")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^项目作品/ }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "project", page: 1, page_size: 8, q: "rust", status: "draft" }), expect.anything()));
    const stats = screen.getByLabelText("内容状态统计");
    expect(within(stats).getByText("4")).toBeTruthy();
    expect(within(stats).getByText("1")).toBeTruthy();
    expect(within(stats).getByText("0")).toBeTruthy();
    expect(await screen.findByRole("columnheader", { name: "项目周期" })).toBeTruthy();
    expect(screen.getByText("2024-01-01 — 至今")).toBeTruthy();
    expect(screen.getByRole("link", { name: "＋ 新建作品" }).getAttribute("href")).toContain("kind=project");
  });
  it("数字分页保留筛选，切换状态或排序回到第一页", async () => {
    const { list } = await setup("/admin/contents?kind=blog&q=rust&status=draft&sort=created_desc");
    fireEvent.click(screen.getByRole("button", { name: "第 2 页" }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, kind: "blog", q: "rust", status: "draft", sort: "created_desc" }), expect.anything()));
    fireEvent.change(screen.getByRole("combobox", { name: "内容状态" }), { target: { value: "published" } });
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, status: "published" }), expect.anything()));
  });
  it("页码超过有效范围时自动回到最后一页", async () => {
    const { list } = await setup("/admin/contents?page=99&q=rust");
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3, q: "rust" }), expect.anything()));
    expect(screen.getByRole("button", { name: "第 3 页" }).getAttribute("aria-current")).toBe("page");
  });
  it("后台预览通过管理员接口读取草稿正文，不请求公开详情", async () => {
    const admin = vi.spyOn(contentApi, "adminDetail").mockResolvedValue({ data: detail });
    const publicDetail = vi.spyOn(contentApi, "detail");
    await setup();
    const row = screen.getByRole("link", { name: "示例项目" }).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "预览" }));
    const dialog = screen.getByRole("dialog", { name: "内容预览" });
    await within(dialog).findByText("后台草稿正文。");
    expect(admin).toHaveBeenCalledWith("project-1", expect.anything());
    expect(publicDetail).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "关闭弹窗" }));
    expect(screen.queryByRole("dialog", { name: "内容预览" })).toBeNull();
  });
  it("保留真实发布操作与版本校验，已发布内容不提供删除按钮", async () => {
    const status = vi.spyOn(contentApi, "status").mockResolvedValue({ data: { ...detail, status: "published", version: 8 } });
    await setup();
    const published = screen.getByRole("link", { name: "Rust 笔记" }).closest("tr")!;
    expect(within(published).queryByRole("button", { name: "删除" })).toBeNull();
    const draft = screen.getByRole("link", { name: "示例项目" }).closest("tr")!;
    fireEvent.click(within(draft).getByRole("button", { name: "发布" }));
    expect(status).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog", { name: "发布内容" })).getByRole("button", { name: "发布" }));
    await waitFor(() => expect(status).toHaveBeenCalledWith("project-1", { status: "published", version: 7 }));
  });
  it("空状态允许清除筛选并保留当前内容类型", async () => {
    const { list } = await setup("/admin/contents?kind=life&q=none&status=draft", true);
    fireEvent.click(await screen.findByRole("button", { name: "清除筛选" }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, kind: "life", q: "", status: undefined, sort: "updated_desc" }), expect.anything()));
  });
});
