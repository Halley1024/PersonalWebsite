// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DatePicker } from "./DatePicker";
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
afterEach(cleanup);
function setup(props: Partial<Parameters<typeof DatePicker>[0]> = {}) {
  const onChange = vi.fn();
  render(<DatePicker label="开始日期" value="2024-01-31" onChange={onChange} {...props} />);
  const trigger = screen.getByRole("button", { name: "开始日期" });
  fireEvent.click(trigger);
  return { onChange, trigger };
}
describe("内容日期选择器", () => {
  it("月份箭头跨年，双箭头切换整年，浏览日历不修改已选日期", () => {
    const { onChange, trigger } = setup();
    fireEvent.click(screen.getByRole("button", { name: "上个月" }));
    expect(screen.getByRole("button", { name: "2023-12-31" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "上一年" }));
    expect(screen.getByRole("button", { name: "2022-12-31" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "下一年" }));
    fireEvent.click(screen.getByRole("button", { name: "下个月" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "2024-01-15" }));
    expect(onChange).toHaveBeenCalledWith("2024-01-15");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it("点击年月后在年、月单位旁分别输入数字，跳转后仍需点击具体日期", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "输入年月，当前 2024-01" }));
    const input = screen.getByRole("textbox", { name: "年份" }) as HTMLInputElement;
    const monthInput = screen.getByRole("textbox", { name: "月份" }) as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect(input.inputMode).toBe("numeric");
    expect(input.value).toBe("2024");
    expect(monthInput.value).toBe("1");
    expect(monthInput.inputMode).toBe("numeric");
    fireEvent.change(input, { target: { value: "20a24年" } });
    fireEvent.change(monthInput, { target: { value: "2月" } });
    expect(input.value).toBe("2024");
    expect(monthInput.value).toBe("2");
    fireEvent.keyDown(monthInput, { key: "Enter" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "输入年月，当前 2024-02" }));
    expect(screen.getByRole("button", { name: "2024-02-29" })).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "2024-02-29" }));
    expect(onChange).toHaveBeenCalledWith("2024-02-29");
  });
  it("拒绝不完整年月、无效月份、零年份，合法输入支持点击跳转", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: /输入年月，当前/ }));
    for (const [year, month] of [["", "2"], ["2024", "13"], ["0", "1"], ["2024", "0"], ["2024", ""]]) {
      fireEvent.change(screen.getByRole("textbox", { name: "年份" }), { target: { value: year } });
      fireEvent.change(screen.getByRole("textbox", { name: "月份" }), { target: { value: month } });
      fireEvent.click(screen.getByRole("button", { name: "跳转" }));
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByRole("button", { name: "2024-01-31" })).toBeTruthy();
    }
    fireEvent.change(screen.getByRole("textbox", { name: "年份" }), { target: { value: "2026" } });
    fireEvent.change(screen.getByRole("textbox", { name: "月份" }), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "跳转" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "2026-02-28" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "2026-02-29" })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
  it("结束日期禁用开始日期前的选项，年月跳转不能绕过范围，可清除为至今", () => {
    const { onChange } = setup({ value: "2024-02-20", min: "2024-02-15", clearable: true });
    expect((screen.getByRole("button", { name: "2024-02-14" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "上一年" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /输入年月，当前/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "年份" }), { target: { value: "2024" } });
    fireEvent.change(screen.getByRole("textbox", { name: "月份" }), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "跳转" }));
    expect(screen.getByRole("alert").textContent).toContain("2024-02");
    fireEvent.click(screen.getByRole("button", { name: "清除日期" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
  it("键盘移动可跨月；Esc取消年月编辑，关闭日历不修改值并恢复页面滚动", () => {
    const { onChange, trigger } = setup();
    fireEvent.keyDown(screen.getByRole("button", { name: "2024-01-31" }), { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "2024-02-01" }));
    fireEvent.click(screen.getByRole("button", { name: /输入年月，当前/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "年份" }), { target: { value: "2026" } });
    fireEvent.change(screen.getByRole("textbox", { name: "月份" }), { target: { value: "12" } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "月份" }), { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "年份" })).toBeNull();
    expect(screen.getByRole("button", { name: "2024-02-01" })).toBeTruthy();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false, cancelable: true }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe("");
  });
});
