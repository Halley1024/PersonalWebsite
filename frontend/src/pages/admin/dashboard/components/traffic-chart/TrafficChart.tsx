import { useId } from "react";
import type { Analytics } from "../../../../../shared/api/generated";
import styles from "./TrafficChart.module.css";
export function TrafficLegend({ monthly = false }: { monthly?: boolean }) {
  return <div className={styles.legend}><span><i />浏览量 PV</span><span><i />{monthly ? "每月访客 UV" : "每日访客 UV"}</span></div>;
}
export function TrafficChart({ series, monthly = false }: { series: Analytics["series"]; monthly?: boolean }) {
  const dateLabel = (date: string) => monthly ? date.slice(0, 7) : date;
  const fillId = useId();
  const maximum = Math.max(4, Math.ceil(Math.max(0, ...series.flatMap((point) => [point.pv, point.uv])) / 4) * 4);
  const x = (index: number) => 64 + index * 560 / Math.max(1, series.length - 1);
  const y = (value: number) => 198 - value / maximum * 170;
  const points = (key: "pv" | "uv") => series.map((point, index) => `${x(index)},${y(point[key])}`).join(" ");
  return <div className={styles.chart}>
    <div className={styles.plot}><svg viewBox="0 0 650 242" role="img" aria-label={monthly ? "最近一年 PV 与每月 UV 趋势" : "所选日期内 PV 与每日 UV 趋势"}>
      <title>访问趋势，具体数值见图表下方数据列表</title>
      <defs><linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".18" /><stop offset="100%" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
      {[0, .25, .5, .75, 1].map((ratio) => <g key={ratio}>
        <line x1="64" x2="624" y1={y(maximum * ratio)} y2={y(maximum * ratio)} stroke="var(--border)" strokeDasharray="3 5" />
        <text x="54" y={y(maximum * ratio) + 4} textAnchor="end">{Math.round(maximum * ratio).toLocaleString("zh-CN")}</text>
      </g>)}
      {!!series.length && <polygon points={`64,198 ${points("pv")} ${x(series.length - 1)},198`} fill={`url(#${fillId})`} />}
      <polyline points={points("uv")} fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinejoin="round" />
      <polyline points={points("pv")} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
      {series.map((row, index) => <g key={row.date}>
        <circle className={styles.point} tabIndex={0} cx={x(index)} cy={y(row.pv)} r="3" fill="var(--accent)" aria-label={`${dateLabel(row.date)}，PV ${row.pv}，UV ${row.uv}`}><title>{dateLabel(row.date)} · PV {row.pv} / UV {row.uv}</title></circle>
        {(series.length <= 7 || index % (monthly ? 2 : 5) === 0 || index === series.length - 1) && <text x={x(index)} y="230" textAnchor="middle">{monthly ? row.date.slice(0, 7).replace("-", "/") : row.date.slice(5).replace("-", "/")}</text>}
      </g>)}
    </svg></div>
    {!series.length && <p className={styles.footnote}>暂无趋势数据</p>}
    <p className={styles.footnote}>PV 统计页面浏览次数，UV 统计{monthly ? "每月" : "每天"}的独立访客。</p>
    <details><summary>查看{monthly ? "每月" : "每日"}数据</summary><div className={styles.data}>{series.map((row) => <span key={row.date}>{dateLabel(row.date)}：PV {row.pv} / UV {row.uv}</span>)}</div></details>
  </div>;
}
