import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { analyticsApi } from "../api/analytics";
import { useSession } from "../session/useSession";
const tracked = new Set<string>();
let queue = Promise.resolve();
export function usePageview(ready: boolean) {
  const location = useLocation();
  const { session } = useSession();
  useEffect(() => {
    if (!ready || !session || session.authenticated) return;
    const key = location.key + location.pathname;
    if (tracked.has(key)) return;
    tracked.add(key);
    if (tracked.size > 100) tracked.delete(tracked.values().next().value!);
    let origin: null | string = null;
    try {
      if (document.referrer) {
        const u = new URL(document.referrer);
        if (["http:", "https:"].includes(u.protocol)) origin = u.origin;
      }
    } catch {
      /* 无有效来源时按 direct。 */
    }
    const body = {
      event_id: crypto.randomUUID(),
      page_path: location.pathname,
      referrer_origin: origin,
    };
    queue = queue.then(async () => {
      try {
        await analyticsApi.pageview(body);
      } catch (error) {
        if (
          error instanceof Error &&
          "status" in error &&
          (error as { status: number }).status === 0
        ) {
          try {
            await analyticsApi.pageview(body);
          } catch {
            /* 统计失败不阻断阅读，不反复重试。 */
          }
        }
      }
    });
  }, [ready, session, location.key, location.pathname]);
}
