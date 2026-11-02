// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ContentWorkspace } from "./ContentWorkspace";
import { contentApi } from "../../../api/content";
import { mediaApi } from "../../../api/media";
import { taxonomyApi } from "../../../api/taxonomy";
import { clearDrafts, readDraft } from "../../../session/drafts";
vi.mock("../../../hooks/useSeo", () => ({ useSeo: () => {} }));
const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clearDrafts(); clients.forEach((client) => client.clear()); clients.length = 0; vi.restoreAllMocks(); });
describe("放弃新建内容", () => {
  it("放弃清空未保存草稿并返回该类型列表，不创建文章或删除媒体", async () => {
    vi.spyOn(taxonomyApi, "list").mockResolvedValue({ data: [], meta: { page: 1, page_size: 100, total: 0, total_pages: 0 } });
    const create = vi.spyOn(contentApi, "create");
    const removeMedia = vi.spyOn(mediaApi, "remove");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client);
    const router = createMemoryRouter([
      { path: "/admin/contents/new", element: <ContentWorkspace kind="blog" /> },
      { path: "/admin/contents", element: <p>内容列表目的地</p> },
    ], { initialEntries: ["/admin/contents/new?kind=blog"] });
    render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "未保存的文章" } });
    fireEvent.change(screen.getByLabelText("封面描述"), { target: { value: "未保存的封面描述\n第二行" } });
    await waitFor(() => expect(readDraft("content:new:blog")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "放弃内容" }));
    await screen.findByText("内容列表目的地");
    expect(router.state.location.search).toBe("?kind=blog");
    expect(readDraft("content:new:blog")).toBeUndefined();
    expect(create).not.toHaveBeenCalled();
    expect(removeMedia).not.toHaveBeenCalled();
    await act(async () => { await router.navigate("/admin/contents/new?kind=blog"); });
    expect((screen.getByLabelText("标题") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("封面描述") as HTMLTextAreaElement).value).toBe("");
  });
});
