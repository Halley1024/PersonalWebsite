// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { authApi } from "../../../../shared/api/auth";
import { clearDrafts, readDraft, writeDraft } from "../../../../shared/session/drafts";
import { PasswordForm } from "./PasswordForm";
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
afterEach(() => { cleanup(); clearDrafts(); clients.forEach((client) => client.clear()); clients.length = 0; vi.restoreAllMocks(); });
function setup() {
  const client = new QueryClient(); clients.push(client);
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/settings"]}><Routes><Route path="/settings" element={<PasswordForm />} /><Route path="/admin/login" element={<p>返回登录页</p>} /></Routes></MemoryRouter></QueryClientProvider>);
  return client;
}
function open() {
  fireEvent.change(screen.getByLabelText("新密码"), { target: { value: "test-new-password" } });
  fireEvent.click(screen.getByRole("button", { name: "修改密码" }));
  return screen.getByRole("dialog", { name: "修改管理员密码" });
}
describe("密码状态与修改验证", () => {
  it("当前密码以固定密文占位显示，为不可修改样式", () => {
    setup();
    const field = screen.getByLabelText("当前密码") as HTMLInputElement;
    expect(field.type).toBe("password"); expect(field.readOnly).toBe(true); expect(field.disabled).toBe(true);
    expect(field.value).toBe("************");
    expect(screen.queryByRole("dialog", { name: "修改管理员密码" })).toBeNull();
  });
  it("取消验证清空原密码，重新打开不会保留输入，不调用接口", () => {
    const api = vi.spyOn(authApi, "password"); setup();
    const dialog = open();
    fireEvent.change(within(dialog).getByLabelText("验证当前密码"), { target: { value: "test-old-password" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
    fireEvent.click(screen.getByRole("button", { name: "修改密码" }));
    expect((screen.getByLabelText("验证当前密码") as HTMLInputElement).value).toBe("");
    expect(api).not.toHaveBeenCalled();
  });
  it("提交真实验证输入和新密码，成功后清空会话缓存及草稿并返回登录", async () => {
    const api = vi.spyOn(authApi, "password").mockResolvedValue(undefined);
    const client = setup(); client.setQueryData(["admin", "settings"], { private: true });
    writeDraft("test-draft", { value: "未保存内容" });
    const dialog = open(); expect(api).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText("验证当前密码"), { target: { value: "test-old-password" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "确认修改" }));
    await screen.findByText("返回登录页");
    expect(api).toHaveBeenCalledWith({ current_password: "test-old-password", new_password: "test-new-password" });
    expect(client.getQueryData(["admin", "settings"])).toBeUndefined();
    expect(client.getQueryData(["session"])).toEqual({ authenticated: false });
    expect(readDraft("test-draft")).toBeUndefined();
  });
  it("验证失败保留弹窗与新密码，可更正原密码重试", async () => {
    const api = vi.spyOn(authApi, "password").mockRejectedValueOnce(new Error("当前密码错误")).mockResolvedValue(undefined);
    setup(); const dialog = open();
    fireEvent.change(within(dialog).getByLabelText("验证当前密码"), { target: { value: "wrong-test-value" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "确认修改" }));
    await within(dialog).findByRole("alert");
    expect((screen.getByLabelText("新密码") as HTMLInputElement).value).toBe("test-new-password");
    fireEvent.change(within(dialog).getByLabelText("验证当前密码"), { target: { value: "correct-test-value" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "确认修改" }));
    await waitFor(() => expect(api).toHaveBeenLastCalledWith({ current_password: "correct-test-value", new_password: "test-new-password" }));
  });
});
