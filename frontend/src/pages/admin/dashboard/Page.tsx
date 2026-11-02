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
import { TrafficChart, TrafficLegend } from "./components/traffic-chart/TrafficChart";
import { DeviceChart } from "./components/device-chart/DeviceChart";
import styles from "./Page.module.css";
const sources: Record<string, string> = {
  direct: "直接访问", github: "GitHub", search: "搜索引擎", bilibili: "Bilibili", other: "其他",
};
const palette = ["var(--accent)", "var(--blue)", "var(--purple)", "var(--warn)"];
export default function Page() {
  const [days, setDays] = useState(7);
  const query = useAnalytics(days);
  const content = useDashboard();
  useSeo("流量总览");
  const data = query.data;
  const monthly = days === 365;
  const windowDays = data ? Math.round((Date.parse(data.end_date) - Date.parse(data.start_date)) / 86400000) + 1 : days;
  const publishedCount = (kind: string) => content.data?.counts
    .filter((row) => row.kind === kind && row.status === "published")
    .reduce((sum, row) => sum + row.count, 0) ?? 0;
  const changeLabel = (value: number | null) => value === null
    ? "暂无上期对比" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  const metrics = data ? [
    { label: "访客人数 UV", value: number(data.uv), symbol: "◉", change: changeLabel(data.uv_change_percent), note: "较上一周期 · 周期内去重" },
    { label: "页面浏览量 PV", value: number(data.pv), symbol: "↗", change: changeLabel(data.pv_change_percent), note: "较上一周期" },
    { label: "日均浏览", value: number(Math.round(data.pv / windowDays)), symbol: "▤", change: "每日平均", note: "所选时间范围" },
    { label: "平均停留时间", value: data.average_duration_seconds === null ? "—" : `${data.average_duration_seconds}s`, symbol: "◷", change: data.average_duration_seconds === null ? "暂无数据" : "平均停留", note: "所选时间范围" },
  ] : [];
  return (
    <div className={styles.page}>
      <PageHeading eyebrow="OVERVIEW / ANALYTICS" title="流量总览"
        description="看看最近有哪些新的相遇，也继续打磨你的内容。"
        actions={<select aria-label="统计范围" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>最近一周（7 天）</option><option value={30}>最近一月（30 天）</option><option value={365}>最近一年（按月）</option>
        </select>}
      />
      <p className={styles.notice}><i aria-hidden="true" />第一方流量统计<span>{monthly ? "北京时间，含本月的最近 12 个月，本月数据尚未结束" : "北京时间，含今日，今日数据尚未结束"}</span></p>
      <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()}>
        {data && <>
          <div className={styles.metrics}>
            {metrics.map((metric) => <section key={metric.label}>
              <div className={styles.metricLabel}>{metric.label}<span aria-hidden="true">{metric.symbol}</span></div>
              <strong>{metric.value}</strong>
              <div className={styles.metricFoot}><span>{metric.change}</span><small>{metric.note}</small></div>
            </section>)}
          </div>
          <div className={styles.grid}>
            <Panel title="访问趋势" description={`${data.start_date} — ${data.end_date}`} actions={<TrafficLegend monthly={monthly} />} className={styles.panel}>
              <TrafficChart series={data.series} monthly={monthly} />
            </Panel>
            <Panel title="流量来源" description="访客从哪里找到你" actions={<span className={styles.panelIcon} aria-hidden="true">↗</span>} className={styles.panel}>
              <div className={styles.total}><strong>{number(data.pv)}</strong><span>次访问</span></div>
              <div className={styles.bars}>
                {data.sources.map((row, index) => {
                  const percent = data.pv ? row.pv / data.pv * 100 : 0;
                  return <div key={row.source}><p><span>{sources[row.source] || row.source}</span><span>{number(row.pv)} · {Math.round(percent)}%</span></p>
                    <div><i style={{ width: `${percent}%`, background: palette[index % palette.length] }} /></div>
                  </div>;
                })}
                {!data.sources.length && <p>暂无来源数据</p>}
              </div>
            </Panel>
            <Panel title="热门内容" description="所选时间内的阅读排行" actions={<Link className={styles.textLink} to="/admin/contents">管理内容 ↗</Link>} className={`${styles.panel} ${styles.popularPanel}`}>
              <div className={styles.tableScroll}><table className={styles.popularTable}>
                <thead><tr><th scope="col">文章</th><th scope="col">类型</th><th scope="col">浏览量</th></tr></thead>
                <tbody>{data.popular_contents.map((row, index) => <tr key={row.content_id}>
                  <td><div className={styles.popularTitle}><span>{String(index + 1).padStart(2, "0")}</span><Link to={isKind(row.kind) ? `/${paths[row.kind]}/${row.slug}` : "/"}>{row.title}</Link></div></td>
                  <td><span className={styles.typeLabel} data-kind={row.kind}>{isKind(row.kind) ? kindNames[row.kind] : row.kind}</span></td>
                  <td>{number(row.pv)}</td>
                </tr>)}{!data.popular_contents.length && <tr><td colSpan={3}>还没有公开内容访问记录。</td></tr>}</tbody>
              </table></div>
            </Panel>
            <Panel title="设备分布" description="关注每一块屏幕上的体验" className={styles.panel}><DeviceChart devices={data.devices} /></Panel>
          </div>
        </>}
      </QueryState>
      <section className={styles.contentOverview} aria-label="内容概况">
        <div><span className={styles.eyebrow}>KEEP CREATING</span><h2>让想法有一个落点。</h2>
          <QueryState loading={content.isPending} error={content.error} retry={() => void content.refetch()}>
            <p>{publishedCount("blog")} 篇博客，{publishedCount("project")} 个作品，{publishedCount("life")} 条生活记录。每一篇，都是新的积累。</p>
          </QueryState>
        </div><ButtonLink to="/admin/contents">进入内容管理 →</ButtonLink>
      </section>
    </div>
  );
}
