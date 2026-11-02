export type ReadingHeading = { id: string; title: string; level: number };
export type ExternalLink = { href: string; title: string; host: string };

// 从渲染结果收集，确保引用式链接、自动链接和实际标题 ID 与正文一致。
export function readArticleInfo(root: HTMLElement, origin: string) {
  const headings: ReadingHeading[] = Array.from(root.querySelectorAll("h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]"))
    .map((heading) => ({ id: heading.id, title: heading.textContent?.trim() || "", level: Number(heading.tagName[1]) }));
  const links = new Map<string, ExternalLink>();
  for (const anchor of root.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    try {
      const url = new URL(anchor.getAttribute("href") || "", origin);
      if (!["https:", "http:"].includes(url.protocol) || url.origin === origin || url.username || url.password) continue;
      if (!links.has(url.href)) links.set(url.href, {
        href: url.href,
        title: anchor.textContent?.replace(/\s+/g, " ").trim() || url.hostname,
        host: url.hostname,
      });
    } catch { /* 无效链接不进入阅读辅助区域。 */ }
  }
  return { headings, links: [...links.values()] };
}

export function readingMinutes(markdown: string) {
  return Math.max(1, Math.ceil(markdown.replace(/\s/g, "").length / 400));
}
