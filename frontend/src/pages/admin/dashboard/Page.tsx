import { useState } from "react";
import { Link } from "react-router-dom";
import { useAnalytics } from "../../../shared/queries/analytics";
import { useDashboard } from "../../../shared/queries/dashboard";
import { useSeo } from "../../../shared/hooks/useSeo";
import { paths } from "../../../shared/api/content";
import { isKind, kindNames } from "../../../shared/utils/content";
import { number } from "../../../shared/utils/date";
import { PageHeading } from "../../../shared/components/ui/page-heading/PageHeading";
import { ButtonLink } from "../../../shared/components/ui/button/Button";
import { Panel } from "../../../shared/components/ui/panel/Panel";
import { QueryState } from "../../../shared/components/ui/query-state/QueryState";
import { TrafficChart } from "./components/traffic-chart/TrafficChart";
import styles from "./Page.module.css";
const sources: Record<string, string> = {
  direct: "直接访问",
  github: "GitHub",
  search: "搜索引擎",
  bilibili: "Bilibili",
  other: "其他",
};
const devices: Record<string, string> = {
  desktop: "桌面",
  mobile: "手机",
  tablet: "平板",
  unknown: "未知",
};
export default function Page() {
  const [days, setDays] = useState(7);
  const query = useAnalytics(days);
  const content = useDashboard();
  useSeo("流量总览");
  const data = query.data;
  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="OVERVIEW / ANALYTICS"
        title="流量总览"
        description="看看最近有哪些新的相遇，也继续打磨你的内容。"
        actions={
          <>
            <select
              aria-label="统计范围"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>最近 7 天</option>
              <option value={30}>最近 30 天</option>
            </select>
            <ButtonLink to="/admin/contents/new?kind=blog">
              ＋ 新建文章
            </ButtonLink>
          </>
        }
      />
      <p className={styles.notice}>
        ● 第一方流量统计 · 北京时间，含今日，今日数据尚未结束
      </p>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      >
        {data && (
          <>
            <div className={styles.metrics}>
              {[
                ["浏览量 / PV", number(data.pv), data.pv_change_percent],
                ["独立访客 / UV", number(data.uv), data.uv_change_percent],
                ["日均浏览", number(Math.round(data.pv / days)), null],
                [
                  "平均停留",
                  data.average_duration_seconds === null
                    ? "—"
                    : `${data.average_duration_seconds}s`,
                  null,
                ],
              ].map(([label, value, change]) => (
                <section key={String(label)}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>
                    {change === null
                      ? "所选时间范围"
                      : `较上期 ${Number(change) >= 0 ? "+" : ""}${Number(change).toFixed(1)}%`}
                  </small>
                </section>
              ))}
            </div>
            <div className={styles.grid}>
              <Panel
                title="访问趋势"
                description={`${data.start_date} — ${data.end_date}`}
              >
                <TrafficChart series={data.series} />
              </Panel>
              <Panel title="流量来源" description="访客从哪里找到你">
                <strong className={styles.total}>
                  {number(data.pv)}
                  <small> 次访问</small>
                </strong>
                <div className={styles.bars}>
                  {data.sources.map((row) => (
                    <div key={row.source}>
                      <p>
                        <span>{sources[row.source] || row.source}</span>
                        <span>{row.pv}</span>
                      </p>
                      <div>
                        <i
                          style={{
                            width: `${data.pv ? (row.pv / data.pv) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {!data.sources.length && <p>暂无来源数据</p>}
                </div>
              </Panel>
              <Panel
                title="热门内容"
                actions={<Link to="/admin/contents">管理内容 ↗</Link>}
              >
                <div className={styles.ranking}>
                  {data.popular_contents.map((row, index) => (
                    <div key={row.content_id}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <Link
                        to={
                          isKind(row.kind)
                            ? `/${paths[row.kind]}/${row.slug}`
                            : "/"
                        }
                      >
                        {row.title}
                      </Link>
                      <small>{number(row.pv)}</small>
                    </div>
                  ))}
                  {!data.popular_contents.length && (
                    <p>还没有公开内容访问记录。</p>
                  )}
                </div>
              </Panel>
              <Panel title="设备分布" description="关注每一块屏幕上的体验">
                <div className={styles.bars}>
                  {data.devices.map((row) => (
                    <div key={row.device}>
                      <p>
                        <span>{devices[row.device] || row.device}</span>
                        <span>
                          {data.pv ? Math.round((row.pv / data.pv) * 100) : 0}%
                          · {row.pv}
                        </span>
                      </p>
                      <div>
                        <i
                          style={{
                            width: `${data.pv ? (row.pv / data.pv) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {!data.devices.length && <p>暂无设备数据</p>}
                </div>
              </Panel>
            </div>
          </>
        )}
      </QueryState>
      <Panel
        title="继续记录与构建"
        actions={<ButtonLink to="/admin/contents">进入内容管理 →</ButtonLink>}
      >
        <QueryState
          loading={content.isPending}
          error={content.error}
          retry={() => void content.refetch()}
        >
          <div className={styles.counts}>
            {(["blog", "project", "life"] as const).map((kind) => (
              <Link key={kind} to={`/admin/contents?kind=${kind}`}>
                <strong>
                  {content.data?.counts
                    .filter((row) => row.kind === kind)
                    .reduce((sum, row) => sum + row.count, 0) || 0}
                </strong>
                {kindNames[kind]}
              </Link>
            ))}
          </div>
        </QueryState>
      </Panel>
    </div>
  );
}
