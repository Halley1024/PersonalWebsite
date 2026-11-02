// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Analytics } from "../../../shared/api/generated";
import { useAnalytics } from "../../../shared/queries/analytics";
import { useDashboard } from "../../../shared/queries/dashboard";
import Page from "./Page";
vi.mock("../../../shared/queries/analytics", () => ({ useAnalytics: vi.fn() }));
vi.mock("../../../shared/queries/dashboard", () => ({ useDashboard: vi.fn() }));
vi.mock("../../../shared/hooks/useSeo", () => ({ useSeo: () => {} }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const data: Analytics = {
  timezone: "Asia/Shanghai", start_date: "2026-10-27", end_date: "2026-11-02", pv: 140, uv: 80,
  pv_change_percent: 12.5, uv_change_percent: null, average_duration_seconds: null,
  series: [{ date: "2026-11-01", pv: 90, uv: 50 }, { date: "2026-11-02", pv: 50, uv: 30 }],
  sources: [{ source: "direct", pv: 140 }], devices: [{ device: "desktop", pv: 105 }, { device: "mobile", pv: 35 }],
  popular_contents: [{ content_id: "1", kind: "blog", title: "真实内容", slug: "real", pv: 120 }],
};
function setup(analytics = data) {
  vi.mocked(useAnalytics).mockReturnValue({ data: analytics, isPending: false, error: null, refetch: vi.fn() } as unknown as ReturnType<typeof useAnalytics>);
  vi.mocked(useDashboard).mockReturnValue({ data: { counts: [{ kind: "blog", status: "published", count: 3 }, { kind: "blog", status: "draft", count: 9 }] }, isPending: false, error: null, refetch: vi.fn() } as unknown as ReturnType<typeof useDashboard>);
  return render(<MemoryRouter><Page /></MemoryRouter>);
}
describe("流量总览", () => {
  it("停留时间不可用时保留缺失状态；内容概况仅计算已发布内容且不显示 IP 明细", () => {
    const { container } = setup();
    const card = screen.getByText("平均停留时间").closest("section")!;
    expect(within(card).getByText("—")).toBeTruthy();
    expect(screen.getByText("暂无上期对比")).toBeTruthy();
    expect(screen.getByText(/3 篇博客，0 个作品，0 条生活记录/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/IP|封锁规则|访问明细/);
    expect(screen.getByRole("link", { name: "真实内容" }).getAttribute("href")).toBe("/posts/real");
    expect(screen.getByRole("img", { name: "设备分布：桌面 75%，手机 25%" })).toBeTruthy();
  });
  it("切换范围重新读取统计，显示实际停留时间", () => {
    setup({ ...data, average_duration_seconds: 42 });
    expect(screen.getByText("42s")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "统计范围" }), { target: { value: "30" } });
    expect(useAnalytics).toHaveBeenLastCalledWith(30);
  });
  it("年度选项切换为每月 UV 与月份明细，日均浏览使用实际窗口天数", () => {
    setup({ ...data, start_date: "2025-12-01", end_date: "2026-11-02", pv: 337, series: [{ date: "2026-01-01", pv: 100, uv: 50 }] });
    fireEvent.change(screen.getByRole("combobox", { name: "统计范围" }), { target: { value: "365" } });
    expect(useAnalytics).toHaveBeenLastCalledWith(365);
    expect(screen.getByText("每月访客 UV")).toBeTruthy();
    expect(screen.getByText("查看每月数据")).toBeTruthy();
    expect(screen.getByRole("img", { name: "最近一年 PV 与每月 UV 趋势" })).toBeTruthy();
    const card = screen.getByText("日均浏览").closest("section")!;
    expect(within(card).getByText("1")).toBeTruthy();
  });
  it("零访问与空排行安全渲染，不生成无效图形", () => {
    const { container } = setup({ ...data, pv: 0, uv: 0, series: [], sources: [], devices: [], popular_contents: [] });
    expect(screen.getByRole("img", { name: "暂无设备数据" })).toBeTruthy();
    expect(screen.getByText("暂无趋势数据")).toBeTruthy();
    expect(screen.getByText("暂无来源数据")).toBeTruthy();
    expect(screen.getByText("还没有公开内容访问记录。")).toBeTruthy();
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  });
});
