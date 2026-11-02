import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { rehypeHeadingIds, transformMarkdownUrl } from "./markdown";
import styles from "./MarkdownRenderer.module.css";
export function MarkdownRenderer({ value }: { value: string }) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }], rehypeHeadingIds]}
        urlTransform={transformMarkdownUrl}
        components={{
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
