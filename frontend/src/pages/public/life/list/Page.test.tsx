// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { PropsWithChildren } from "react";
import type { PublicCard } from "../../../../shared/api/generated";
import { contentApi } from "../../../../shared/api/content";
import { useLifeFeed } from "./hooks/useLifeFeed";
import Page from "./Page";

vi.mock("../../../../shared/hooks/usePageview", () => ({ usePageview: () => {} }));
vi.mock("../../../../shared/hooks/useSeo", () => ({ useSeo: () => {} }));
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
  vi.restoreAllMocks();
});
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
  };
}
function batch(page: number, count = 9, total = 18) {
  const data: PublicCard[] = Array.from({ length: count }, (_, index) => ({
    id: `${(page - 1) * 9 + index + 1}`, kind: "life", slug: `slice-${(page - 1) * 9 + index + 1}`,
    title: `生活切片${(page - 1) * 9 + index + 1}`, excerpt: "生活记录简介", cover: null, category: null,
    tags: [], featured: false, published_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z",
  }));
  return { data, meta: { page, page_size: 9, total, total_pages: Math.ceil(total / 9) } };
}
function reachBottom() {
  const node = screen.getByRole("region", { name: "生活切片列表，可向下滚动" });
  Object.defineProperties(node, {
    clientHeight: { configurable: true, value: 400 },
    scrollHeight: { configurable: true, value: 1000 },
    scrollTop: { configurable: true, value: 600 },
  });
  fireEvent.scroll(node);
  return node;
}

describe("生活切片异步列表", () => {
  it("首批只取9条，滚动后追加9条，重复滚动不会并发重复请求", async () => {
    let resolve!: (value: ReturnType<typeof batch>) => void;
    const pending = new Promise<ReturnType<typeof batch>>((done) => { resolve = done; });
    const api = vi.spyOn(contentApi, "list").mockResolvedValueOnce(batch(1)).mockReturnValueOnce(pending);
    render(<Page />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(9));
    expect(api).toHaveBeenCalledTimes(1);
    expect(api.mock.calls[0].slice(0, 2)).toEqual(["life", { page: 1, page_size: 9 }]);
    const node = reachBottom();
    fireEvent.scroll(node);
    fireEvent.scroll(node);
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    expect(api.mock.calls[1].slice(0, 2)).toEqual(["life", { page: 2, page_size: 9 }]);
    await act(async () => resolve(batch(2)));
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(18));
    fireEvent.scroll(node);
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("下一批失败时保留已有切片，并允许点击箭头重试", async () => {
    const api = vi.spyOn(contentApi, "list")
      .mockResolvedValueOnce(batch(1))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(batch(2));
    render(<Page />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(9));
    reachBottom();
    const retry = await screen.findByRole("button", { name: "重新加载更多生活切片" });
    expect(screen.getAllByRole("article")).toHaveLength(9);
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(18));
    expect(api).toHaveBeenCalledTimes(3);
  });

  it("空数据即停止翻页，并显示空状态而不是无限请求", async () => {
    const api = vi.spyOn(contentApi, "list").mockResolvedValue(batch(1, 0, 0));
    render(<Page />, { wrapper: wrapper() });
    await screen.findByText("这里暂时没有匹配的内容。");
    reachBottom();
    expect(api).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "向下浏览生活切片" })).toBeNull();
  });

  it("滚动时切换上下渐隐入口，到底只保留向上入口，回顶只保留向下入口", async () => {
    const api = vi.spyOn(contentApi, "list").mockResolvedValue(batch(1, 9, 9));
    render(<Page />, { wrapper: wrapper() });
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(9));
    const node = screen.getByRole("region", { name: "生活切片列表，可向下滚动" });
    Object.defineProperties(node, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1000 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });
    fireEvent.scroll(node);
    expect(screen.queryByRole("button", { name: "向上浏览生活切片" })).toBeNull();
    expect(screen.getByRole("button", { name: "向下浏览生活切片" })).toBeTruthy();
    node.scrollTop = 300;
    fireEvent.scroll(node);
    expect(screen.getByRole("button", { name: "向上浏览生活切片" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "向下浏览生活切片" })).toBeTruthy();
    node.scrollTop = 600;
    fireEvent.scroll(node);
    expect(screen.getByRole("button", { name: "向上浏览生活切片" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "向下浏览生活切片" })).toBeNull();
    node.scrollTop = 0;
    fireEvent.scroll(node);
    expect(screen.queryByRole("button", { name: "向上浏览生活切片" })).toBeNull();
    expect(screen.getByRole("button", { name: "向下浏览生活切片" })).toBeTruthy();
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("接口返回意外空页时也停止继续加载", async () => {
    vi.spyOn(contentApi, "list").mockResolvedValue(batch(1, 0, 99));
    const { result } = renderHook(useLifeFeed, { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });
});
