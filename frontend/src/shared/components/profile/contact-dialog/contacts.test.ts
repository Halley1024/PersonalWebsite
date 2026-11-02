import { describe, expect, it } from "vitest";
import { contactMethods } from "./contacts";

describe("联系我弹窗数据", () => {
  it("使用公开资料并保留自定义联系方式，网址显示简洁地址而跳转保留完整参数", () => {
    const methods = contactMethods({ public_email: "person@example.com", social_links: [
      { label: "代码", url: "https://github.com/tester" },
      { label: "视频", url: "https://space.bilibili.com/123?source=profile" },
      { label: "个人站点", url: "https://example.com/profile" },
    ] });
    expect(methods.map((method) => method.label)).toEqual(["邮箱", "GitHub", "Bilibili", "个人站点"]);
    expect(methods[0].href).toBe("mailto:person@example.com");
    expect(methods[2].value).toBe("space.bilibili.com/123");
    expect(methods[2].href).toBe("https://space.bilibili.com/123?source=profile");
  });
  it("未公开的联系方式显示待补充，不使用原型中的示例地址", () => {
    const methods = contactMethods({ public_email: null, social_links: [] });
    expect(methods).toHaveLength(3);
    expect(methods.every((method) => method.value === "待补充" && !method.href)).toBe(true);
  });
  it("忽略危险地址和含凭据的网址，同时保留多个同平台的有效链接", () => {
    const methods = contactMethods({ public_email: "invalid", social_links: [
      { label: "危险", url: "javascript:alert(1)" },
      { label: "凭据", url: "https://name:secret@github.com/test" },
      { label: "主账号", url: "https://github.com/one" },
      { label: "另一个账号", url: "https://github.com/two" },
    ] });
    expect(methods.filter((method) => method.href).map((method) => method.href)).toEqual(["https://github.com/one", "https://github.com/two"]);
  });
});
