// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AdminProfile } from "../../../shared/api/generated";
import { profileApi } from "../../../shared/api/profile";
import { clearDrafts } from "../../../shared/session/drafts";
import Page from "./Page";
vi.mock("../../../shared/hooks/useSeo", () => ({ useSeo: () => {} }));
vi.mock("../../../shared/components/media/media-picker/MediaPicker", () => ({
  MediaPicker: ({ onSelect }: { onSelect: (item: { id: string }) => void }) => <button onClick={() => onSelect({ id: "78328cb6-d1d3-458f-8a49-85b06a48ccf5" })}>使用测试头像</button>,
}));
const initial: AdminProfile = {
  display_name: "测试名字", headline: "开发者", intro: "原始导语", bio_markdown: "原始正文", stats: { experience: "3+", projects: "8", notes: "12" },
  avatar_media_id: null, avatar: null, location_label: "中国", public_email: null, social_links: [], skill_groups: [{ title: "编程语言", items: ["Rust"] }],
  experiences: [{ id: "1c56c79e-6da3-4e52-9cd8-7b16e95e21a0", title: "原有经历", organization: "测试组织", start_date: "2024-01", end_date: null, description: "原有经历描述" }],
  version: 1, updated_at: "2026-11-02T00:00:00Z",
};
const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clearDrafts(); clients.forEach((client) => client.clear()); clients.length = 0; vi.restoreAllMocks(); });
async function setup(profile = initial) {
  vi.spyOn(profileApi, "admin").mockResolvedValue({ data: structuredClone(profile) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  clients.push(client);
  const router = createMemoryRouter([{ path: "/admin/profile", element: <Page /> }], { initialEntries: ["/admin/profile"] });
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);
  await screen.findByLabelText("显示名称");
  return screen.getByRole("complementary", { name: "关于我页面实时预览" });
}
describe("个人介绍编辑与预览", () => {
  it("只有顶部保存按钮，修改立即预览，保存保留经历及版本", async () => {
    const update = vi.spyOn(profileApi, "update").mockImplementation(async (body) => ({ data: { ...initial, ...body, avatar: null, version: 2 } }));
    const preview = await setup();
    const buttons = screen.getAllByRole("button", { name: "保存个人介绍" });
    expect(buttons).toHaveLength(1);
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("显示名称"), { target: { value: "修改后的名字" } });
    fireEvent.change(screen.getByLabelText("详细介绍"), { target: { value: "**新的详细介绍**" } });
    expect(within(preview).getByText("修改后的名字")).toBeTruthy();
    expect(within(preview).getByText("新的详细介绍").tagName).toBe("STRONG");
    expect(within(preview).getByText("未保存预览")).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ display_name: "修改后的名字", experiences: initial.experiences, version: 1 }));
    await waitFor(() => expect(screen.getByText("所有修改已保存")).toBeTruthy());
    expect(within(preview).getByText("当前资料")).toBeTruthy();
  });
  it("有修改才显示撤销和放弃，撤销逐步恢复最后修改及预览", async () => {
    const preview = await setup();
    expect(screen.queryByRole("button", { name: "撤销" })).toBeNull();
    expect(screen.queryByRole("button", { name: "放弃修改" })).toBeNull();
    fireEvent.change(screen.getByLabelText("显示名称"), { target: { value: "修改名字" } });
    fireEvent.change(screen.getByLabelText("简短介绍"), { target: { value: "修改导语" } });
    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    expect((screen.getByLabelText("简短介绍") as HTMLTextAreaElement).value).toBe(initial.intro);
    expect((screen.getByLabelText("显示名称") as HTMLInputElement).value).toBe("修改名字");
    expect(within(preview).getByText("修改名字")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    expect((screen.getByLabelText("显示名称") as HTMLInputElement).value).toBe(initial.display_name);
    expect(screen.queryByRole("button", { name: "撤销" })).toBeNull();
    expect(screen.getByText("所有修改已保存")).toBeTruthy();
  });
  it("放弃修改恢复字段和被删除的技能组，不向服务器提交", async () => {
    const update = vi.spyOn(profileApi, "update");
    const preview = await setup();
    fireEvent.change(screen.getByLabelText("经验"), { target: { value: "9+" } });
    fireEvent.change(screen.getByLabelText("GitHub 链接"), { target: { value: "https://github.com/test" } });
    fireEvent.click(screen.getByRole("button", { name: "移除第 1 个技能分组" }));
    fireEvent.click(screen.getByRole("button", { name: "放弃修改" }));
    expect((screen.getByLabelText("经验") as HTMLInputElement).value).toBe(initial.stats.experience);
    expect((screen.getByLabelText("GitHub 链接") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: "第 1 组技能 1" }).textContent).toBe("Rust");
    expect(within(preview).getByText("Rust")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "放弃修改" })).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
  it("保存后清空撤销记录，后续放弃回到最新保存的内容", async () => {
    vi.spyOn(profileApi, "update").mockImplementation(async (body) => ({ data: { ...initial, ...body, avatar: null, version: 2 } }));
    await setup();
    fireEvent.change(screen.getByLabelText("显示名称"), { target: { value: "新保存名字" } });
    fireEvent.click(screen.getByRole("button", { name: "保存个人介绍" }));
    await waitFor(() => expect(screen.getByText("所有修改已保存")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "撤销" })).toBeNull();
    fireEvent.change(screen.getByLabelText("显示名称"), { target: { value: "另一次修改" } });
    fireEvent.click(screen.getByRole("button", { name: "放弃修改" }));
    expect((screen.getByLabelText("显示名称") as HTMLInputElement).value).toBe("新保存名字");
    fireEvent.change(screen.getByLabelText("显示名称"), { target: { value: "再修改" } });
    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    expect((screen.getByLabelText("显示名称") as HTMLInputElement).value).toBe("新保存名字");
    expect(screen.queryByRole("button", { name: "撤销" })).toBeNull();
  });
  it("技能与展示数据实时更新，预览链接打开公开关于页面", async () => {
    const preview = await setup();
    fireEvent.click(screen.getByRole("button", { name: "为第 1 组添加技能" }));
    fireEvent.change(screen.getByLabelText("第 1 组技能 2"), { target: { value: "TypeScript" } });
    fireEvent.change(screen.getByLabelText("经验"), { target: { value: "5+" } });
    expect(within(preview).getByText("TypeScript")).toBeTruthy();
    expect(within(preview).getByText("5+")).toBeTruthy();
    expect(within(preview).getByRole("link", { name: "查看公开页面" }).getAttribute("href")).toBe("/about");
    expect(within(preview).queryByText("原有经历")).toBeNull();
    expect(within(preview).queryByText("经历与足迹")).toBeNull();
  });
  it("技能通过加号独立添加和编辑，逗号不再拆分技能", async () => {
    const update = vi.spyOn(profileApi, "update").mockImplementation(async (body) => ({ data: { ...initial, ...body, avatar: null, version: 2 } }));
    const preview = await setup();
    fireEvent.click(screen.getByRole("button", { name: "为第 1 组添加技能" }));
    const input = screen.getByLabelText("第 1 组技能 2");
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "C++,C#" } });
    expect(within(preview).getByText("C++,C#")).toBeTruthy();
    fireEvent.doubleClick(screen.getByRole("button", { name: "第 1 组技能 1" }));
    fireEvent.change(screen.getByLabelText("第 1 组技能 1"), { target: { value: "TypeScript" } });
    fireEvent.doubleClick(screen.getByRole("button", { name: "第 1 组技能 2" }));
    fireEvent.click(screen.getByRole("button", { name: "移除第 1 组技能 2" }));
    expect(screen.queryByLabelText("第 1 组技能 2")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "保存个人介绍" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ skill_groups: [{ title: "编程语言", items: ["TypeScript"] }] })));
    await waitFor(() => expect(screen.getByText("所有修改已保存")).toBeTruthy());
  });
  it("技能单击保持只读，双击后显示输入框和删除图标，回车结束编辑", async () => {
    const preview = await setup();
    const skill = screen.getByRole("button", { name: "第 1 组技能 1" });
    fireEvent.click(skill);
    expect(screen.queryByRole("textbox", { name: "第 1 组技能 1" })).toBeNull();
    expect(screen.queryByRole("button", { name: "移除第 1 组技能 1" })).toBeNull();
    fireEvent.doubleClick(skill);
    const input = screen.getByRole("textbox", { name: "第 1 组技能 1" });
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole("button", { name: "移除第 1 组技能 1" })).toBeTruthy();
    fireEvent.change(input, { target: { value: "TypeScript" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("button", { name: "第 1 组技能 1" }).textContent).toBe("TypeScript");
    expect(screen.queryByRole("button", { name: "移除第 1 组技能 1" })).toBeNull();
    expect(within(preview).getByText("TypeScript")).toBeTruthy();
  });
  it("组内拖拽更新预览顺序，可撤销；键盘排序结果能保存", async () => {
    const update = vi.spyOn(profileApi, "update").mockImplementation(async (body) => ({ data: { ...initial, ...body, avatar: null, version: 2 } }));
    const preview = await setup({ ...initial, skill_groups: [{ title: "编程语言", items: ["Rust", "TypeScript", "Go"] }] });
    const transfer = { setData: vi.fn(), effectAllowed: "", dropEffect: "" };
    const source = screen.getByRole("button", { name: "第 1 组技能 1" }).parentElement!;
    const target = screen.getByRole("button", { name: "第 1 组技能 3" }).parentElement!;
    fireEvent.dragStart(source, { dataTransfer: transfer });
    fireEvent.dragOver(target, { dataTransfer: transfer });
    fireEvent.drop(target, { dataTransfer: transfer });
    expect(within(preview).getAllByText(/^(Rust|TypeScript|Go)$/).map((node) => node.textContent)).toEqual(["TypeScript", "Go", "Rust"]);
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    expect(within(preview).getAllByText(/^(Rust|TypeScript|Go)$/).map((node) => node.textContent)).toEqual(["Rust", "TypeScript", "Go"]);
    fireEvent.keyDown(screen.getByRole("button", { name: "第 1 组技能 1" }), { key: "ArrowRight", altKey: true });
    fireEvent.click(screen.getByRole("button", { name: "保存个人介绍" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ skill_groups: [{ title: "编程语言", items: ["TypeScript", "Rust", "Go"] }] })));
  });
  it("Esc 恢复编辑前的技能文字，外部拖拽不改变顺序", async () => {
    await setup();
    fireEvent.doubleClick(screen.getByRole("button", { name: "第 1 组技能 1" }));
    const input = screen.getByRole("textbox", { name: "第 1 组技能 1" });
    fireEvent.change(input, { target: { value: "未确认" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.getByRole("button", { name: "第 1 组技能 1" }).textContent).toBe("Rust");
    fireEvent.drop(screen.getByRole("button", { name: "第 1 组技能 1" }).parentElement!, { dataTransfer: { getData: () => "unrelated" } });
    expect(screen.getByRole("button", { name: "第 1 组技能 1" }).textContent).toBe("Rust");
  });
  it("右上角叉号只删除对应技能组，删除最后一组仍保留整个板块与新增入口", async () => {
    await setup();
    fireEvent.click(screen.getByRole("button", { name: "＋ 添加分组" }));
    const second = screen.getByRole("region", { name: "技能分组 2" });
    fireEvent.change(within(second).getByLabelText("分组名称"), { target: { value: "开发工具" } });
    fireEvent.click(within(second).getByRole("button", { name: "为第 2 组添加技能" }));
    fireEvent.change(within(second).getByLabelText("第 2 组技能 1"), { target: { value: "Git" } });
    fireEvent.click(screen.getByRole("button", { name: "移除第 1 个技能分组" }));
    expect((screen.getByLabelText("分组名称") as HTMLInputElement).value).toBe("开发工具");
    expect(screen.getByRole("heading", { name: "技能分组" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "移除第 1 个技能分组" }));
    expect(screen.queryByLabelText("分组名称")).toBeNull();
    expect(screen.getByRole("heading", { name: "技能分组" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "＋ 添加分组" })).toBeTruthy();
  });
  it("基本资料提供固定社交链接，兼容旧链接且清空后移除", async () => {
    const update = vi.spyOn(profileApi, "update").mockImplementation(async (body) => ({ data: { ...initial, ...body, avatar: null, version: 2 } }));
    await setup({ ...initial, social_links: [
      { label: "代码主页", url: "https://github.com/old" },
      { label: "视频主页", url: "https://space.bilibili.com/123" },
      { label: "其他网站", url: "https://example.com" },
    ] });
    expect((screen.getByLabelText("GitHub 链接") as HTMLInputElement).value).toBe("https://github.com/old");
    expect((screen.getByLabelText("Bilibili 链接") as HTMLInputElement).value).toBe("https://space.bilibili.com/123");
    expect(screen.queryByRole("heading", { name: /社交链接/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "＋ 添加链接" })).toBeNull();
    fireEvent.change(screen.getByLabelText("GitHub 链接"), { target: { value: "https://github.com/new" } });
    fireEvent.change(screen.getByLabelText("Bilibili 链接"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "保存个人介绍" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ social_links: [
      { label: "其他网站", url: "https://example.com" }, { label: "GitHub", url: "https://github.com/new" },
    ] })));
    await waitFor(() => expect(screen.getByText("所有修改已保存")).toBeTruthy());
  });
  it("头像未设置时显示名字首字，点击头像可选择，右上角移除后恢复首字", async () => {
    await setup();
    const avatar = screen.getByRole("button", { name: "选择头像" });
    expect(within(avatar).getByLabelText("未设置头像").textContent).toBe("测");
    expect(screen.queryByRole("button", { name: "移除头像" })).toBeNull();
    fireEvent.click(avatar);
    fireEvent.click(screen.getByRole("button", { name: "使用测试头像" }));
    expect(screen.getByAltText("当前头像预览").getAttribute("src")).toContain("78328cb6-d1d3-458f-8a49-85b06a48ccf5");
    fireEvent.click(screen.getByRole("button", { name: "移除头像" }));
    expect(screen.queryByAltText("当前头像预览")).toBeNull();
    expect(within(avatar).getByLabelText("未设置头像").textContent).toBe("测");
  });
  it("作品和笔记只读显示后端计数，经验仍可手动维护并保存", async () => {
    const update = vi.spyOn(profileApi, "update").mockImplementation(async (body) => ({ data: { ...initial, ...body, avatar: null, version: 2 } }));
    const preview = await setup();
    const projects = screen.getByLabelText("作品") as HTMLInputElement;
    const notes = screen.getByLabelText("笔记") as HTMLInputElement;
    const experience = screen.getByLabelText("经验") as HTMLInputElement;
    expect(projects.readOnly).toBe(true);
    expect(notes.readOnly).toBe(true);
    expect(projects.value).toBe("8");
    expect(notes.value).toBe("12");
    expect(experience.readOnly).toBe(false);
    expect((screen.getByRole("button", { name: "保存个人介绍" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(experience, { target: { value: "6+" } });
    expect(within(preview).getByText("6+")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "保存个人介绍" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ stats: { experience: "6+", projects: "8", notes: "12" } })));
    await waitFor(() => expect(screen.getByText("所有修改已保存")).toBeTruthy());
  });
  it("预览使用原生内部滚动，标题和滚动边界不带动外层页面", async () => {
    const scrollPage = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const preview = await setup();
    const viewport = within(preview).getByRole("region", { name: "关于我页面预览内容" });
    Object.defineProperties(viewport, { clientHeight: { configurable: true, value: 300 }, scrollHeight: { configurable: true, value: 1000 } });
    const wheel = (target: HTMLElement, deltaY: number, ctrlKey = false) => {
      const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY, ctrlKey });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(wheel(viewport, 40)).toBe(false);
    expect(wheel(viewport, -40)).toBe(true);
    viewport.scrollTop = 700;
    expect(wheel(viewport, 40)).toBe(true);
    expect(wheel(viewport, -40)).toBe(false);
    expect(wheel(within(preview).getByText("展示预览"), 40)).toBe(true);
    expect(wheel(within(preview).getByText(/左侧修改会实时显示/), 40)).toBe(true);
    expect(wheel(viewport, 40, true)).toBe(false);
    expect(scrollPage).not.toHaveBeenCalled();
  });
  it("保存失败保留编辑内容，顶部允许重试", async () => {
    vi.spyOn(profileApi, "update").mockRejectedValue(new Error("保存失败"));
    const preview = await setup();
    fireEvent.change(screen.getByLabelText("简短介绍"), { target: { value: "需要保留的修改" } });
    const save = screen.getByRole("button", { name: "保存个人介绍" });
    fireEvent.click(save);
    await screen.findByRole("alert");
    expect(within(preview).getByText("需要保留的修改")).toBeTruthy();
    expect((save as HTMLButtonElement).disabled).toBe(false);
  });
});
