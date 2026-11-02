import type { PublicProfile } from "../../../api/generated";
import { safeLink } from "../../../utils/url";
export type ContactMethod = {
  label: string;
  value: string;
  href?: string;
  kind: "email" | "github" | "bilibili" | "website";
};
function emailMethod(value: string, label = "邮箱"): ContactMethod {
  const email = value.trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return { kind: "email", label, value: valid ? email : "待补充",
    href: valid ? `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}` : undefined };
}
export function contactMethods(profile: Pick<PublicProfile, "public_email" | "social_links">): ContactMethod[] {
  const socials: ContactMethod[] = [];
  for (const link of profile.social_links) {
    if (!safeLink(link.url)) continue;
    try {
      const url = new URL(link.url);
      if (url.protocol === "mailto:") {
        const method = emailMethod(link.url.slice(7), link.label);
        if (method.href) socials.push(method);
        continue;
      }
      if (url.protocol !== "https:" || url.username || url.password) continue;
      const host = url.hostname;
      const kind = host === "github.com" || host.endsWith(".github.com") ? "github"
        : host === "bilibili.com" || host.endsWith(".bilibili.com") ? "bilibili" : "website";
      socials.push({ kind, label: link.label, href: url.href, value: host + url.pathname.replace(/\/$/, "") });
    } catch { /* 无效地址不显示为可点击的联系方式。 */ }
  }
  const result: ContactMethod[] = [emailMethod(profile.public_email || "")];
  for (const [kind, label] of [["github", "GitHub"], ["bilibili", "Bilibili"]] as const) {
    const index = socials.findIndex((method) => method.kind === kind);
    if (index >= 0) result.push({ ...socials.splice(index, 1)[0], label });
    else result.push({ kind, label, value: "待补充" });
  }
  return [...result, ...socials];
}
