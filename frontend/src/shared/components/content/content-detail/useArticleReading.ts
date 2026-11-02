import { useEffect, useRef, useState, type RefObject } from "react";
import { readArticleInfo, type ReadingHeading, type ExternalLink } from "./reading";
const empty = { headings: [] as ReadingHeading[], links: [] as ExternalLink[] };

export function useArticleReading(body: RefObject<HTMLDivElement | null>, markdown: string, contentKey: string, ready: boolean) {
  const [info, setInfo] = useState({ key: "", ...empty });
  const [active, setActive] = useState("");
  const progress = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = body.current;
    setInfo({ key: contentKey, ...(node && ready ? readArticleInfo(node, window.location.origin) : empty) });
  }, [body, markdown, contentKey, ready]);
  const current = info.key === contentKey ? info : empty;
  useEffect(() => {
    const node = body.current;
    if (!node || !ready) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const start = node.getBoundingClientRect().top + window.scrollY - 130;
      const range = Math.max(1, node.offsetHeight - window.innerHeight + 160);
      const ratio = Math.max(0, Math.min(1, (window.scrollY - start) / range));
      if (progress.current) progress.current.style.transform = `scaleX(${ratio})`;
      let id = current.headings[0]?.id || "";
      for (const heading of current.headings) {
        const element = document.getElementById(heading.id);
        if (element && node.contains(element) && element.getBoundingClientRect().top <= 180) id = heading.id;
      }
      setActive(id);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    node.addEventListener("load", schedule, true);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : undefined;
    observer?.observe(node);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      node.removeEventListener("load", schedule, true);
      observer?.disconnect();
    };
  }, [body, contentKey, ready, current.headings]);
  return { ...current, active, progress };
}
