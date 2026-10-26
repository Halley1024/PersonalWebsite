import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { headingSlug, transformMarkdownUrl } from "./markdown";
import styles from "./MarkdownRenderer.module.css";
function text(nodes: ReactNode): string {
  return Children.toArray(nodes)
    .map((n) =>
      typeof n === "string" || typeof n === "number"
        ? String(n)
        : isValidElement<{ children?: ReactNode }>(n)
          ? text(n.props.children)
          : "",
    )
    .join("");
}
export function MarkdownRenderer({ value }: { value: string }) {
  const counts = new Map<string, number>();
  const heading = (level: 1 | 2 | 3 | 4 | 5 | 6, children: ReactNode) => {
    const slug = headingSlug(text(children));
    const count = counts.get(slug) || 0;
    counts.set(slug, count + 1);
    const id = count ? `${slug}-${count}` : slug;
    const Tag = `h${level}` as const;
    return <Tag id={id}>{children}</Tag>;
  };
  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
        urlTransform={transformMarkdownUrl}
        components={{
          h1: ({ children }) => heading(1, children),
          h2: ({ children }) => heading(2, children),
          h3: ({ children }) => heading(3, children),
          h4: ({ children }) => heading(4, children),
          h5: ({ children }) => heading(5, children),
          h6: ({ children }) => heading(6, children),
          a: ({ href, children }) =>
            href ? (
              <a
                href={href}
                target={href.startsWith("https:") ? "_blank" : undefined}
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
          img: ({ src, alt }) =>
            typeof src === "string" &&
            /^\/api\/v1\/media\/[0-9a-f-]{36}$/i.test(src) ? (
              <img src={src} alt={alt || ""} loading="lazy" decoding="async" />
            ) : (
              <span className={styles.blocked}>不支持的图片引用</span>
            ),
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}
