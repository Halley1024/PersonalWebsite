// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { contentApi } from "../../../api/content";
import type { PublicCard } from "../../../api/generated";
import * as adjacent from "./useAdjacentContents";
import { ArticleNavigation } from "./ArticleNavigation";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function page(number: number) {
  return { data: Array.from({ length: number === 1 ? 50 : 5 }, (_, index) => ({
    id: String((number - 1) * 50 + index + 1), slug: `entry-${(number - 1) * 50 + index + 1}`,
    title: `内容${(number - 1) * 50 + index + 1}`,
  } as PublicCard)), meta: { page: number, page_size: 50, total: 55, total_pages: 2 } };
}

describe("正文前后篇导航", () => {
  it("列表页边界上的下一篇可以跨页查找", async () => {
    const api = vi.spyOn(contentApi, "list").mockResolvedValueOnce(page(1)).mockResolvedValueOnce(page(2));
    const result = await adjacent.loadAdjacentContents("blog", "50");
    expect(result.previous?.id).toBe("49");
    expect(result.next?.id).toBe("51");
    expect(api.mock.calls.map((call) => call.slice(0, 2))).toEqual([
      ["blog", { page: 1, page_size: 50 }], ["blog", { page: 2, page_size: 50 }],
    ]);
  });
  it("第二页第一条的上一篇指向前一页末尾", async () => {
    vi.spyOn(contentApi, "list").mockResolvedValueOnce(page(1)).mockResolvedValueOnce(page(2));
    const result = await adjacent.loadAdjacentContents("project", "51");
    expect(result.previous?.id).toBe("50");
    expect(result.next?.id).toBe("52");
  });
  it("首末篇返回真实边界，找不到当前记录时不伪装成边界", async () => {
    const api = vi.spyOn(contentApi, "list").mockResolvedValueOnce(page(1));
    expect((await adjacent.loadAdjacentContents("life", "1")).previous).toBeNull();
    api.mockResolvedValueOnce(page(1)).mockResolvedValueOnce(page(2));
    expect((await adjacent.loadAdjacentContents("life", "55")).next).toBeNull();
    api.mockResolvedValueOnce(page(1)).mockResolvedValueOnce(page(2));
    await expect(adjacent.loadAdjacentContents("life", "missing")).rejects.toThrow("暂时无法确定相邻内容");
  });
  it("卡片显示标题并跳转到同栏目的正文，边界卡片不可点击", () => {
    vi.spyOn(adjacent, "useAdjacentContents").mockReturnValue({
      data: { previous: null, next: { id: "two", slug: "second", title: "第二篇作品" } },
      isPending: false, isError: false,
    } as ReturnType<typeof adjacent.useAdjacentContents>);
    render(<MemoryRouter><ArticleNavigation kind="project" id="one" /></MemoryRouter>);
    expect(screen.getByText("已是第一篇作品").closest("[aria-disabled]")?.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("link", { name: /下一篇.*第二篇作品/ }).getAttribute("href")).toBe("/projects/second");
  });
});
