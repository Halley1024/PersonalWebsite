// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mediaApi } from "../../../shared/api/media";
import type { Media } from "../../../shared/api/generated";
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
afterEach(() => { cleanup(); clients.forEach((client) => client.clear()); clients.length=0; vi.restoreAllMocks(); });
const rows: Media[] = [0,1].map((index) => ({ id: `media-${index}`, url: `/original-${index}.webp`, thumbnail_url: `/thumb-${index}.webp`, width:800, height:600, mime_type:"image/webp", byte_size:2048, alt:index ? "引用图片" : "海边散步", created_at:"2026-11-02T00:00:00Z", reference_count:index ? 2 : 0 }));
async function setup(path="/admin/media") {
  const list=vi.spyOn(mediaApi,"list").mockResolvedValue({data:rows,meta:{page:1,page_size:12,total:25,total_pages:3}});
  const stats=vi.spyOn(mediaApi,"stats").mockResolvedValue({data:{all:25,blog:11,project:8,life:7,unused:3}});
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0},mutations:{retry:false}}});clients.push(client);
  const router=createMemoryRouter([{path:"/admin/media",element:<Page/>}],{initialEntries:[path]});
  render(<QueryClientProvider client={client}><RouterProvider router={router}/></QueryClientProvider>);
  await screen.findByRole("button",{name:"预览海边散步"});
  return {list,stats,router};
}
describe("媒体库图片管理",()=>{
  it("统计独立于当前页，类型标签和描述搜索同步查询，改变筛选回第一页",async()=>{
    const {list}=await setup("/admin/media?page=2");
    expect(within(screen.getByLabelText("媒体统计")).getByText("11")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("group",{name:"媒体类型筛选"})).getByRole("button",{name:/技术博客/}));
    await waitFor(()=>expect(list).toHaveBeenLastCalledWith(expect.objectContaining({kind:"blog",page:1,page_size:12}),expect.anything()));
    fireEvent.change(screen.getByRole("searchbox",{name:"媒体描述"}),{target:{value:"海边"}});
    fireEvent.submit(screen.getByRole("search",{name:"搜索媒体描述"}));
    await waitFor(()=>expect(list).toHaveBeenLastCalledWith(expect.objectContaining({kind:"blog",q:"海边",page:1}),expect.anything()));
    fireEvent.click(await screen.findByRole("button",{name:"第 2 页"}));
    await waitFor(()=>expect(list).toHaveBeenLastCalledWith(expect.objectContaining({kind:"blog",q:"海边",page:2}),expect.anything()));
    fireEvent.click(within(screen.getByRole("group",{name:"媒体类型筛选"})).getByRole("button",{name:/未引用/}));
    await waitFor(()=>expect(list).toHaveBeenLastCalledWith(expect.objectContaining({unused:true,q:"海边",page:1}),expect.anything()));
    expect(list.mock.calls.at(-1)?.[0]?.kind).toBeUndefined();
  });
  it("点击图片在本页弹窗预览原图及元数据",async()=>{
    await setup();
    fireEvent.click(screen.getByRole("button",{name:"预览海边散步"}));
    const dialog=screen.getByRole("dialog",{name:"图片预览"});
    expect(within(dialog).getByRole("img",{name:"海边散步"}).getAttribute("src")).toBe("/original-0.webp");
    expect(within(dialog).getByText(/800 × 600/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button",{name:"关闭弹窗"}));
    expect(screen.queryByRole("dialog",{name:"图片预览"})).toBeNull();
  });
  it("右上角删除开启图标，引用图片不可删除，确认后才调用删除并刷新统计",async()=>{
    const {stats}=await setup();
    const remove=vi.spyOn(mediaApi,"remove").mockResolvedValue(undefined);
    expect(screen.queryByRole("button",{name:"删除海边散步"})).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"删除"}));
    expect((screen.getByRole("button",{name:"删除引用图片"}) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button",{name:"删除海边散步"}));
    expect(remove).not.toHaveBeenCalled();
    const count=stats.mock.calls.length;
    fireEvent.click(within(screen.getByRole("dialog",{name:"永久删除图片"})).getByRole("button",{name:"删除图片"}));
    await waitFor(()=>expect(remove).toHaveBeenCalledWith("media-0"));
    await waitFor(()=>expect(stats.mock.calls.length).toBeGreaterThan(count));
    fireEvent.click(screen.getByRole("button",{name:"完成删除"}));
    expect(screen.queryByRole("button",{name:"删除海边散步"})).toBeNull();
  });
  it("上传通过弹窗完成，成功后关闭并回到全部图片，刷新统计",async()=>{
    const {stats,router}=await setup("/admin/media?kind=blog&q=rust");
    const upload=vi.spyOn(mediaApi,"upload").mockResolvedValue({data:rows[0]});
    expect(screen.queryByRole("dialog",{name:"上传图片"})).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"上传"}));
    const dialog=screen.getByRole("dialog",{name:"上传图片"});
    const file=new File(["image"],"photo.webp",{type:"image/webp"});
    fireEvent.change(within(dialog).getByLabelText("上传图片"),{target:{files:[file]}});
    fireEvent.change(within(dialog).getByLabelText("图片描述（替代文本）"),{target:{value:"新图片描述"}});
    const count=stats.mock.calls.length;
    fireEvent.click(within(dialog).getByRole("button",{name:"上传到媒体库"}));
    await waitFor(()=>expect(upload).toHaveBeenCalledWith(file,"新图片描述"));
    await waitFor(()=>expect(screen.queryByRole("dialog",{name:"上传图片"})).toBeNull());
    expect(router.state.location.search).toBe("");
    expect(stats.mock.calls.length).toBeGreaterThan(count);
  });
  it("删除失败时保留确认弹窗与图片，允许重试",async()=>{
    await setup();
    vi.spyOn(mediaApi,"remove").mockRejectedValue(new Error("图片已被引用"));
    fireEvent.click(screen.getByRole("button",{name:"删除"}));
    fireEvent.click(screen.getByRole("button",{name:"删除海边散步"}));
    const dialog=screen.getByRole("dialog",{name:"永久删除图片"});
    fireEvent.click(within(dialog).getByRole("button",{name:"删除图片"}));
    await within(dialog).findByRole("alert");
    expect(screen.getByRole("button",{name:"预览海边散步"})).toBeTruthy();
  });
});
