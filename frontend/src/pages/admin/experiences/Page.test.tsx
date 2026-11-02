// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AdminProfile } from "../../../shared/api/generated";
import { profileApi } from "../../../shared/api/profile";
import Page from "./Page";
vi.mock("../../../shared/hooks/useSeo", () => ({ useSeo: () => {} }));
const initial: AdminProfile = {
  display_name: "保留名字", headline: "保留定位", intro: "保留导语", bio_markdown: "保留正文", stats: { experience: "3+", projects: "2", notes: "8" },
  avatar_media_id: null, avatar: null, location_label: "中国", public_email: null, social_links: [{ label: "GitHub", url: "https://github.com/test" }], skill_groups: [], version: 1, updated_at: "2026-11-02T00:00:00Z",
  experiences: [
    { id: "1c56c79e-6da3-4e52-9cd8-7b16e95e21a0", title: "阶段一", organization: "测试组织", start_date: "2024-01", end_date: null, description: "原始描述" },
    { id: "2c56c79e-6da3-4e52-9cd8-7b16e95e21a0", title: "阶段二", organization: "另一组织", start_date: "2023-01", end_date: "2023-12", description: "第二阶段描述" },
  ],
};
const clients: QueryClient[] = [];
const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterAll(() => {
  if (originalShow) Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShow); else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose); else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});
afterEach(() => { cleanup(); clients.forEach((client) => client.clear()); clients.length = 0; vi.restoreAllMocks(); });
async function setup() {
  let server = structuredClone(initial);
  vi.spyOn(profileApi, "admin").mockImplementation(async () => ({ data: structuredClone(server) }));
  const update = vi.spyOn(profileApi, "update").mockImplementation(async (body) => {
    server = { ...server, ...body, version: body.version + 1 };
    return { data: structuredClone(server) };
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  clients.push(client);
  const router = createMemoryRouter([{ path: "/admin/experiences", element: <Page /> }], { initialEntries: ["/admin/experiences"] });
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);
  await screen.findByRole("button", { name: "＋ 新增经历" });
  return { update, preview: screen.getByRole("complementary", { name: "经历与足迹展示预览" }) };
}
describe("经历与足迹参考交互", () => {
  it("左侧卡片通过弹窗编辑，描述占独立一行，保存保留其余资料", async () => {
    const { update, preview } = await setup();
    expect(screen.queryByLabelText("经历描述")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "编辑" })[0]);
    const dialog = screen.getByRole("dialog", { name: "编辑经历" });
    const description = within(dialog).getByLabelText("经历描述");
    expect(description.parentElement?.parentElement?.tagName).toBe("FIELDSET");
    expect((within(dialog).getByRole("button", { name: "结束时间" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("经历标题"), { target: { value: "更新阶段" } });
    fireEvent.change(description, { target: { value: "更新后的完整描述" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存经历" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "编辑经历" })).toBeNull());
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ display_name: initial.display_name, headline: initial.headline, social_links: initial.social_links, version: 1 }));
    expect(within(preview).getByText("更新后的完整描述")).toBeTruthy();
  });
  it("月份弹层支持年份切换，结束月份禁用早于开始月份的选项，新经历置于首条", async () => {
    const { update, preview } = await setup();
    fireEvent.click(screen.getByRole("button", { name: "＋ 新增经历" }));
    const dialog = screen.getByRole("dialog", { name: "新增经历" });
    fireEvent.change(within(dialog).getByLabelText("经历标题"), { target: { value: "新阶段" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "开始时间" }));
    let month = screen.getByRole("dialog", { name: "选择开始时间" });
    fireEvent.change(within(month).getByRole("combobox", { name: "年份" }), { target: { value: "2025" } });
    fireEvent.click(within(month).getByRole("button", { name: "2025-02" }));
    fireEvent.click(within(dialog).getByLabelText("持续至今"));
    fireEvent.click(within(dialog).getByRole("button", { name: "结束时间" }));
    month = screen.getByRole("dialog", { name: "选择结束时间" });
    expect((within(month).getByRole("button", { name: "2025-01" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(month).getByRole("button", { name: "2025-03" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "保存经历" }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "新增经历" })).toBeNull());
    expect(update.mock.calls[0][0].experiences[0]).toEqual(expect.objectContaining({ title: "新阶段", start_date: "2025-02", end_date: "2025-03" }));
    expect(within(preview).getAllByRole("heading", { level: 3 })[0].textContent).toBe("新阶段");
  });
  it("弹窗未保存修改关闭时需要确认，放弃不提交", async () => {
    const { update } = await setup();
    fireEvent.click(screen.getAllByRole("button", { name: "编辑" })[0]);
    const dialog = screen.getByRole("dialog", { name: "编辑经历" });
    fireEvent.change(within(dialog).getByLabelText("经历描述"), { target: { value: "未保存描述" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
    const confirm = screen.getByRole("dialog", { name: "放弃这条经历的未保存修改？" });
    fireEvent.click(within(confirm).getByRole("button", { name: "放弃修改" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "编辑经历" })).toBeNull());
    expect(update).not.toHaveBeenCalled();
  });
  it("保存失败时保留弹窗输入并允许重试", async () => {
    const { update } = await setup();
    update.mockRejectedValueOnce(new Error("保存失败"));
    fireEvent.click(screen.getAllByRole("button", { name: "编辑" })[0]);
    const dialog = screen.getByRole("dialog", { name: "编辑经历" });
    fireEvent.change(within(dialog).getByLabelText("经历描述"), { target: { value: "保留的编辑内容" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "保存经历" }));
    await within(dialog).findByRole("alert");
    expect((within(dialog).getByLabelText("经历描述") as HTMLTextAreaElement).value).toBe("保留的编辑内容");
    expect((within(dialog).getByRole("button", { name: "保存经历" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(within(dialog).getByRole("button", { name: "保存经历" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "编辑经历" })).toBeNull());
  });
  it("排序按钮只在总条数下方显示，分别按开始月份正序与倒序保存", async () => {
    const { update, preview } = await setup();
    expect(screen.queryByRole("button", { name: /上移|下移/ })).toBeNull();
    const controls = screen.getByRole("group", { name: "时间排序" });
    expect(controls.parentElement?.textContent).toContain("共 2 条");
    fireEvent.click(within(controls).getByRole("button", { name: "时间顺序" }));
    await waitFor(() => expect(within(preview).getAllByRole("heading", { level: 3 }).map((node) => node.textContent)).toEqual(["阶段二", "阶段一"]));
    await waitFor(() => expect((within(controls).getByRole("button", { name: "时间倒序" }) as HTMLButtonElement).disabled).toBe(false));
    expect(within(controls).getByRole("button", { name: "时间顺序" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(controls).getByRole("button", { name: "时间倒序" }));
    await waitFor(() => expect(within(preview).getAllByRole("heading", { level: 3 }).map((node) => node.textContent)).toEqual(["阶段一", "阶段二"]));
    await waitFor(() => expect((within(controls).getByRole("button", { name: "时间倒序" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(within(controls).getByRole("button", { name: "时间倒序" }));
    expect(update).toHaveBeenCalledTimes(2);
  });
  it("排序即时保存，删除确认后可按原位置撤销", async () => {
    const { update, preview } = await setup();
    fireEvent.click(screen.getByRole("button", { name: "时间顺序" }));
    await waitFor(() => expect(within(preview).getAllByRole("heading", { level: 3 })[0].textContent).toBe("阶段二"));
    await waitFor(() => expect((screen.getByRole("button", { name: "＋ 新增经历" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getAllByRole("button", { name: "删除" })[0]);
    const confirm = screen.getByRole("dialog", { name: "删除这条经历？" });
    expect(update).toHaveBeenCalledOnce();
    fireEvent.click(within(confirm).getByRole("button", { name: "删除经历" }));
    await waitFor(() => expect(within(preview).queryByText("阶段二")).toBeNull());
    const undo = await screen.findByRole("button", { name: "撤销删除" });
    fireEvent.click(undo);
    await waitFor(() => expect(within(preview).getAllByRole("heading", { level: 3 }).map((node) => node.textContent)).toEqual(["阶段二", "阶段一"]));
    expect(update.mock.calls.map((call) => call[0].version)).toEqual([1, 2, 3]);
  });
});
