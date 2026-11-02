// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useVisits } from "../../../shared/queries/analytics";
import { useRegions } from "../../../shared/queries/access";
import { DateRangePicker } from "./components/date-range-picker/DateRangePicker";
import { visitRange } from "./components/date-range-picker/dates";
import Page from "./Page";
vi.mock("../../../shared/queries/analytics", () => ({ useVisits: vi.fn() }));
vi.mock("../../../shared/queries/access", () => ({ useRegions: vi.fn() }));
vi.mock("../../../shared/hooks/useSeo", () => ({ useSeo: () => {} }));
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-02T10:00:00Z"));
  vi.mocked(useRegions).mockReturnValue({ data: [{ id: "cn-test", label: "测试区域", blockable: true }] } as ReturnType<typeof useRegions>);
  vi.mocked(useVisits).mockReturnValue({ isPending: false, error: null, refetch: vi.fn(), data: {
    data: [{ id: "1", ip: "192.0.2.1", occurred_at: "2026-11-02T01:00:00Z", region_id: "cn-test", region_label: "测试区域", network_label: "测试网络", page_path: "/posts/test", page_title: "测试页面", content_id: null, source: "github", device: "desktop", matched_rule_ids: [] }],
    meta: { page: 1, page_size: 20, total: 60, total_pages: 3 },
  } } as unknown as ReturnType<typeof useVisits>);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });
describe("访问日期范围", () => {
  it("默认7天，规范化非法日期、范围外日期与倒序日期", () => {
    expect(visitRange(null, null, "2026-11-02")).toEqual({ start_date: "2026-10-27", end_date: "2026-11-02" });
    expect(visitRange("2026-09-01", "2026-12-01", "2026-11-02")).toEqual({ start_date: "2026-10-04", end_date: "2026-11-02" });
    expect(visitRange("2026-02-30", "garbage", "2026-11-02")).toEqual({ start_date: "2026-10-27", end_date: "2026-11-02" });
    expect(visitRange("2026-11-02", "2026-10-20", "2026-11-02")).toEqual({ start_date: "2026-10-20", end_date: "2026-10-20" });
  });
  it("日历禁用未来与30天前日期，允许首尾，支持快捷日期与Esc关闭", () => {
    const change = vi.fn();
    render(<DateRangePicker today="2026-11-02" value={{ start_date: "2026-10-27", end_date: "2026-11-02" }} onChange={change} />);
    const trigger = screen.getByRole("button", { name: "结束日期 2026-11-02" });
    fireEvent.click(trigger);
    expect((screen.getByRole("button", { name: "2026-11-03" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "下个月" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "上个月" }));
    expect((screen.getByRole("button", { name: "2026-10-03" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "2026-10-04" }));
    expect(change).toHaveBeenLastCalledWith({ start_date: "2026-10-04", end_date: "2026-10-04" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "最近 30 天" }));
    expect(change).toHaveBeenLastCalledWith({ start_date: "2026-10-04", end_date: "2026-11-02" });
    fireEvent.click(trigger); fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
describe("访问明细页面", () => {
  it("URL绕过不能查询过早或未来记录，指标不把当前页当作所有IP", () => {
    render(<MemoryRouter initialEntries={["/admin/visits?start_date=2025-01-01&end_date=2027-01-01"]}><Page /></MemoryRouter>);
    expect(useVisits).toHaveBeenLastCalledWith(expect.objectContaining({ start_date: "2026-10-04", end_date: "2026-11-02" }));
    const summary = screen.getByLabelText("访问记录概况");
    expect(within(summary).getByText("60")).toBeTruthy();
    expect(within(summary).getByText("个独立 IP · 当前页")).toBeTruthy();
    expect(screen.getByText("测试网络")).toBeTruthy();
    expect(screen.getByRole("link", { name: "封锁 IP" }).getAttribute("href")).toContain("/admin/access-rules?scope=ip&ip=192.0.2.1");
    expect(screen.queryByText("封锁规则")).toBeNull();
  });
  it("快捷日期与筛选重置回第一页，分页保留筛选", () => {
    render(<MemoryRouter initialEntries={["/admin/visits?page=2&source=github"]}><Page /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "最近 30 天" }));
    expect(useVisits).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, source: "github", start_date: "2026-10-04" }));
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    expect(useVisits).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, source: "github", start_date: "2026-10-04" }));
    fireEvent.click(screen.getByRole("button", { name: "重置筛选" }));
    expect(useVisits).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, source: "", start_date: "2026-10-27" }));
  });
  it("空记录提供恢复入口", () => {
    vi.mocked(useVisits).mockReturnValue({ isPending: false, error: null, data: { data: [], meta: { total: 0, total_pages: 0, page: 1, page_size: 20 } } } as unknown as ReturnType<typeof useVisits>);
    render(<MemoryRouter><Page /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "清除访问筛选" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "下一页" })).toBeNull();
  });
});
