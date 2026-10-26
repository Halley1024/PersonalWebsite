export function safeReturnTo(value: unknown) {
  return typeof value === "string" &&
    /^\/admin(?:\/|$)/.test(value) &&
    !value.startsWith("//") &&
    !value.startsWith("/admin/login") &&
    !value.includes("\\")
    ? value
    : "/admin";
}
export function safeLink(value: string) {
  return /^(https:\/\/|mailto:)/i.test(value) && !/[\u0000-\u0020]/.test(value)
    ? value
    : undefined;
}
