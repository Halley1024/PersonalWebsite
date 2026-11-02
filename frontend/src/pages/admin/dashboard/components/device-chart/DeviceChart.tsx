import type { Analytics } from "../../../../../shared/api/generated";
import styles from "./DeviceChart.module.css";
const labels: Record<string, string> = { desktop: "桌面", mobile: "手机", tablet: "平板", unknown: "未知" };
const colors: Record<string, string> = { desktop: "var(--accent)", mobile: "var(--blue)", tablet: "var(--purple)", unknown: "var(--warn)" };
export function DeviceChart({ devices }: { devices: Analytics["devices"] }) {
  const total = devices.reduce((sum, row) => sum + row.pv, 0);
  const desktop = devices.find((row) => row.device === "desktop")?.pv ?? 0;
  let offset = 0;
  const segments = devices.map((row) => {
    const percent = total ? row.pv / total * 100 : 0;
    const segment = { ...row, percent, offset, label: labels[row.device] || row.device, color: colors[row.device] || "var(--faint)" };
    offset += percent;
    return segment;
  });
  return <div className={styles.device}>
    <svg viewBox="0 0 200 200" role="img" aria-label={total ? `设备分布：${segments.map((row) => `${row.label} ${Math.round(row.percent)}%`).join("，")}` : "暂无设备数据"}>
      <circle cx="100" cy="100" r="72" fill="none" stroke="var(--bg-soft)" strokeWidth="18" />
      {segments.filter((row) => row.percent > 0).map((row) => <circle key={row.device} cx="100" cy="100" r="72" fill="none" stroke={row.color} strokeWidth="18" pathLength="100" strokeDasharray={`${Math.max(0, row.percent - Math.min(.8, row.percent / 4))} ${100 - row.percent + Math.min(.8, row.percent / 4)}`} strokeDashoffset={-row.offset} transform="rotate(-90 100 100)" />)}
      <text x="100" y="96" textAnchor="middle" className={styles.value}>{total ? `${Math.round(desktop / total * 100)}%` : "—"}</text>
      <text x="100" y="120" textAnchor="middle" className={styles.label}>{total ? "桌面访问占比" : "暂无设备数据"}</text>
    </svg>
    <div className={styles.legend}>{segments.map((row) => <span key={row.device}><i style={{ background: row.color }} />{row.label}<strong>{Math.round(row.percent)}%</strong></span>)}</div>
  </div>;
}
