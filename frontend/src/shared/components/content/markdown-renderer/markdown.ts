export function headingText(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();
}
export function headingSlug(value: string) {
  return (
    headingText(value)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-") || "section"
  );
}
export function toc(markdown: string) {
  let fenced = false;
  const ids = new Map<string, number>();
  const result: { id: string; title: string; level: number }[] = [];
  for (const line of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const slug = headingSlug(match[2]);
    const count = ids.get(slug) || 0;
    ids.set(slug, count + 1);
    result.push({
      id: count ? `${slug}-${count}` : slug,
      title: headingText(match[2]),
      level: match[1].length,
    });
  }
  return result;
}
export function transformMarkdownUrl(url: string) {
  if (
    /^media:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      url,
    )
  )
    return `/api/v1/media/${url.slice(6)}`;
  if (
    /^https:\/\//i.test(url) ||
    /^mailto:/i.test(url) ||
    url.startsWith("#") ||
    (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\"))
  )
    return url;
  return "";
}
