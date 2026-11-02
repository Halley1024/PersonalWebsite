import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, LoaderCircle } from "lucide-react";
import { usePageview } from "../../../../shared/hooks/usePageview";
import { useSeo } from "../../../../shared/hooks/useSeo";
import { QueryState } from "../../../../shared/components/ui/query-state/QueryState";
import { useLifeFeed } from "./hooks/useLifeFeed";
import { LifeCard } from "../../../../shared/components/content/life-card/LifeCard";
import styles from "./Page.module.css";

export default function Page() {
  const feed = useLifeFeed();
  const viewport = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const items = [...new Map(feed.data?.pages.flatMap((page) => page.data).map((item) => [item.id, item])).values()];
  const total = feed.data?.pages[0]?.meta.total || 0;
  const title = "代码之外的生活";
  const description = "在构建与探索之间，记录那些平凡而珍贵的时刻。";
  useSeo(title, description);
  usePageview(feed.isSuccess);

  const nearBottom = () => {
    const node = viewport.current;
    return !!node && node.scrollHeight - node.scrollTop - node.clientHeight <= 120;
  };
  const loadMore = () => {
    if (feed.hasNextPage && !feed.isFetching) {
      void feed.fetchNextPage({ cancelRefetch: false });
    }
  };
  const onScroll = () => {
    const node = viewport.current;
    if (!node) return;
    setAtTop(node.scrollTop <= 2);
    setAtBottom(node.scrollHeight - node.scrollTop - node.clientHeight <= 2);
    if (nearBottom() && !feed.isFetchNextPageError) loadMore();
  };
  useEffect(() => {
    const updateBottom = () => {
      const node = viewport.current;
      if (node) {
        setAtTop(node.scrollTop <= 2);
        setAtBottom(node.scrollHeight - node.scrollTop - node.clientHeight <= 2);
      }
    };
    updateBottom();
    window.addEventListener("resize", updateBottom);
    return () => window.removeEventListener("resize", updateBottom);
  }, [items.length]);

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <p className={styles.label}>04 / Life</p>
        <h1>{title}<span>.</span></h1>
        <p className={styles.description}>{description}</p>
      </header>
      <div className={styles.viewer}>
        <div
          ref={viewport}
          className={styles.viewport}
          role="region"
          aria-label="生活切片列表，可向下滚动"
          aria-busy={feed.isFetchingNextPage}
          tabIndex={0}
          onScroll={onScroll}
          onWheel={(event) => {
            if (event.deltaY > 0 && nearBottom() && !feed.isFetchNextPageError) loadMore();
          }}
          onKeyDown={(event) => {
            if (["ArrowDown", "PageDown", "End"].includes(event.key) && nearBottom() && !feed.isFetchNextPageError) loadMore();
          }}
        >
          <QueryState
            loading={feed.isPending}
            error={!feed.data ? feed.error : undefined}
            retry={() => void feed.refetch()}
            empty={feed.isSuccess && items.length === 0}
            emptyText="这里暂时没有匹配的内容。"
          >
            <div className={styles.grid}>
              {items.map((item, index) => <LifeCard key={item.id} item={item} index={index} />)}
            </div>
          </QueryState>
        </div>
        {items.length > 0 && !atTop && (
          <div className={`${styles.fade} ${styles.topFade}`}>
            <button
              type="button"
              className={styles.down}
              aria-label="向上浏览生活切片"
              onClick={() => viewport.current?.scrollBy({
                top: -viewport.current.clientHeight * 0.8,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
              })}
            >
              <ArrowUp size={20} />
            </button>
          </div>
        )}
        {items.length > 0 && (feed.hasNextPage || !atBottom || feed.isFetchNextPageError) && (
          <div className={styles.fade}>
            <span className={feed.isFetchNextPageError ? styles.retry : "sr-only"} role="status" aria-live="polite">
              {feed.isFetchNextPageError ? "加载失败，点击下方箭头重试。" : `已加载 ${items.length} / ${total} 条生活记录`}
            </span>
            <button
              type="button"
              className={styles.down}
              disabled={feed.isFetching || (!feed.hasNextPage && atBottom)}
              aria-label={feed.isFetchNextPageError ? "重新加载更多生活切片" : "向下浏览生活切片"}
              onClick={() => {
                if (feed.isFetchNextPageError || nearBottom()) loadMore();
                else viewport.current?.scrollBy({
                  top: viewport.current.clientHeight * 0.8,
                  behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                });
              }}
            >
              {feed.isFetchingNextPage ? <LoaderCircle className={styles.spinner} size={20} /> : <ArrowDown size={20} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
