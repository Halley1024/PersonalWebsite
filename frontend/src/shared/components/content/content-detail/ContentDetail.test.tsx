// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { StrictMode } from "react";
import type { PublicDetail } from "../../../api/generated";
import { usePublicDetail } from "../../../queries/content";
import { usePublicProfile } from "../../../queries/profile";
import { ContentDetail } from "./ContentDetail";

vi.mock("../../../queries/content", () => ({ usePublicDetail: vi.fn() }));
vi.mock("../../../queries/profile", () => ({ usePublicProfile: vi.fn() }));
vi.mock("../../../hooks/useSeo", () => ({ useSeo: () => {} }));
vi.mock("../../../hooks/usePageview", () => ({ usePageview: () => {} }));
vi.mock("./useAdjacentContents", () => ({ useAdjacentContents: () => ({
  data: { previous: null, next: null }, isPending: false, isError: false,
}) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function item(kind: PublicDetail["kind"], body = "# 简介\n\n这是正文。 "): PublicDetail {
  return {
    id: "one", kind, slug: "example", title: "文章标题", excerpt: "文章摘要", cover: null,
    category: { id: "category", slug: "rust", name: "Rust 分类" },
    tags: [{ id: "tag", slug: "async", name: "异步" }], featured: false,
    published_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-02T00:00:00Z",
    body_markdown: body, seo_title: null, seo_description: null, gallery: [],
    project: kind === "project" ? { tech_stack: ["Rust", "React"], started_on: "2026-01-01", ended_on: null,
      project_stage: "building", repository_url: "https://github.com/example/project", demo_url: "https://example.com/demo" } : null,
    life: kind === "life" ? { occurred_on: "2026-10-30", location_label: "深圳" } : null,
  };
}
function show(value: PublicDetail) {
  vi.mocked(usePublicDetail).mockReturnValue({ data: value, isPending: false, isSuccess: true,
    error: null, refetch: vi.fn() } as unknown as ReturnType<typeof usePublicDetail>);
  vi.mocked(usePublicProfile).mockReturnValue({ data: { display_name: "Halley" } } as ReturnType<typeof usePublicProfile>);
  return render(<StrictMode><MemoryRouter initialEntries={["/content/example"]}><Routes>
    <Route path="/content/:slug" element={<ContentDetail kind={value.kind} />} />
  </Routes></MemoryRouter></StrictMode>);
}

describe("正文阅读布局", () => {
  it("博客在目录下显示分类、标签和时间", async () => {
    show(item("blog"));
    const sidebar = screen.getByRole("complementary", { name: "阅读辅助" });
    const metadata = within(sidebar).getByRole("region", { name: "正文元信息" });
    expect(within(metadata).getByText("Rust 分类")).toBeTruthy();
    expect(within(metadata).getByRole("link", { name: "异步" }).getAttribute("href")).toBe("/posts?tag=async");
    expect(within(metadata).getByText("发布时间")).toBeTruthy();
    const toc = await within(sidebar).findByRole("navigation", { name: "文章目录" });
    expect(within(toc).getByRole("link", { name: /简介/ }).getAttribute("href")).toBe("#简介");
  });

  it("多分类详情展示全部已选分类", () => {
    const value = item("blog");
    value.categories = [value.category!, { id: "category-2", slug: "engineering", name: "工程实践" }];
    show(value);
    expect(within(screen.getByRole("region", { name: "正文元信息" })).getByText("Rust 分类 · 工程实践")).toBeTruthy();
  });

  it("作品显示技术栈、项目时间和源码，源码不会误触发正文外部链接区域", () => {
    show(item("project"));
    const metadata = screen.getByRole("region", { name: "正文元信息" });
    expect(within(metadata).getByText("React")).toBeTruthy();
    expect(within(metadata).getByText("项目时间")).toBeTruthy();
    const source = within(metadata).getByRole("link", { name: /查看源码/ });
    expect(source.getAttribute("href")).toBe("https://github.com/example/project");
    expect(source.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.queryByRole("region", { name: "正文外部链接" })).toBeNull();
  });

  it("生活记录显示分类、标签、记录日期和地点", () => {
    show(item("life"));
    const metadata = screen.getByRole("region", { name: "正文元信息" });
    expect(within(metadata).getByText("Rust 分类")).toBeTruthy();
    expect(within(metadata).getByText("异步")).toBeTruthy();
    expect(within(metadata).getByText("深圳")).toBeTruthy();
    expect(within(metadata).getByText("2026/10/30")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "正文外部链接" })).toBeNull();
  });

  it("从实际正文提取引用式外链并去重，排除站内、锚点、代码及危险链接", async () => {
    show(item("blog", [
      "# 标题 **A**", "", "[官方网站][official]", "[重复外链](https://example.com/docs)",
      "[站内](/posts/other)", "[章节](#标题-a)", "[危险](javascript:alert(1))",
      "", "```text", "[代码不是外链](https://code.example)", "```", "",
      "标题 **A**", "===========", "", "[official]: https://example.com/docs",
    ].join("\n")));
    const external = await screen.findByRole("region", { name: "正文外部链接" });
    const links = within(external).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("https://example.com/docs");
    const toc = screen.getByRole("navigation", { name: "文章目录" });
    expect(within(toc).getAllByRole("link").map((link) => link.getAttribute("href")))
      .toEqual(["#标题-a", "#标题-a-1"]);
  });
});
