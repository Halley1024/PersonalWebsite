import type { Analytics } from "../../../../../shared/api/generated";
import styles from "./TrafficChart.module.css";
export function TrafficChart({ series }: { series: Analytics["series"] }) {
  const maximum = Math.max(
    1,
    ...series.flatMap((point) => [point.pv, point.uv]),
  );
  const points = (key: "pv" | "uv") =>
    series
      .map(
        (point, index) =>
          `${40 + (index * 620) / Math.max(1, series.length - 1)},${190 - (point[key] / maximum) * 150}`,
      )
      .join(" ");
  return (
    <div className={styles.chart}>
      <div className={styles.legend}>
        <span>● 浏览量 PV</span>
        <span>● 每日访客 UV</span>
      </div>
      <svg
        viewBox="0 0 700 230"
        role="img"
        aria-label="所选日期内 PV 与每日 UV 趋势"
      >
        <title>访问趋势，具体数值见图表下方数据列表</title>
        {[0, 0.5, 1].map((ratio) => (
          <g key={ratio}>
            <line
              x1="40"
              x2="670"
              y1={190 - ratio * 150}
              y2={190 - ratio * 150}
              stroke="currentColor"
              strokeOpacity=".1"
            />
            <text x="0" y={194 - ratio * 150} fill="currentColor" fontSize="10">
              {Math.round(maximum * ratio)}
            </text>
          </g>
        ))}
        <polyline
          points={points("pv")}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
        />
        <polyline
          points={points("uv")}
          fill="none"
          stroke="var(--blue)"
          strokeWidth="2"
        />
        {series
          .filter((_, i) => i === 0 || i === series.length - 1)
          .map((row, index) => (
            <text
              key={row.date}
              x={index ? 620 : 40}
              y="220"
              fill="currentColor"
              fontSize="11"
            >
              {row.date.slice(5)}
            </text>
          ))}
      </svg>
      <details>
        <summary>查看每日数据</summary>
        <div className={styles.data}>
          {series.map((row) => (
            <span key={row.date}>
              {row.date}：PV {row.pv} / UV {row.uv}
            </span>
          ))}
        </div>
      </details>
    </div>
  );
}
