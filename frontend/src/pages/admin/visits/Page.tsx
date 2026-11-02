import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ShieldCheck } from "lucide-react";
import { useVisits } from "../../../shared/queries/analytics";
import { useRegions } from "../../../shared/queries/access";
import { useUrlFilters } from "../../../shared/hooks/useUrlFilters";
import { useSeo } from "../../../shared/hooks/useSeo";
import { beijingDay, date, number } from "../../../shared/utils/date";
import { PageHeading } from "../../../shared/components/ui/page-heading/PageHeading";
import { Button } from "../../../shared/components/ui/button/Button";
import { QueryState } from "../../../shared/components/ui/query-state/QueryState";
import { Pagination } from "../../../shared/components/ui/pagination/Pagination";
import { DateRangePicker } from "./components/date-range-picker/DateRangePicker";
import { visitRange } from "./components/date-range-picker/dates";
import styles from "./Page.module.css";
const sourceNames: Record<string, string> = { direct: "直接访问", github: "GitHub", search: "搜索引擎", bilibili: "Bilibili", other: "其他" };
const deviceNames: Record<string, string> = { desktop: "桌面", mobile: "手机", tablet: "平板", unknown: "未知设备" };
export default function Page() {
  const { params, page, update } = useUrlFilters();
  const [today, setToday] = useState(() => beijingDay());
  useEffect(() => {
    const refresh = () => setToday(beijingDay());
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  const range = visitRange(params.get("start_date"), params.get("end_date"), today);
  const filters = { page, page_size: 20, q: params.get("q") || "", ...range, source: params.get("source") || "", region_id: params.get("region_id") || "" };
  const query = useVisits(filters);
  const regions = useRegions();
  const rows = query.data?.data ?? [];
  const pageRegions = [...new Map(rows.filter((row) => row.region_id !== "unknown").map((row) => [row.region_id, row.region_label])).entries()];
  const reset = () => update({ q: "", start_date: "", end_date: "", source: "", region_id: "" });
  useSeo("访问明细");
  return <div className={styles.page}>
    <PageHeading eyebrow="ANALYTICS / VISITORS" title="访问明细" description="了解每一次到访，关注真实访问与网站体验。" />
    <section className={styles.panel} aria-labelledby="visitors-title">
      <div className={styles.heading}><div><h2 id="visitors-title">访客 IP 与区域</h2><p>{range.start_date} — {range.end_date} · 时间以北京时间显示</p></div><span className={styles.badge}><ShieldCheck size={14} aria-hidden="true" />服务器访问记录</span></div>
      <div className={styles.overview} aria-label="访问记录概况">
        <div><strong>{query.data ? number(query.data.meta.total) : "—"}</strong><span>条匹配记录</span></div>
        <div><strong>{query.data ? number(new Set(rows.map((row) => row.ip)).size) : "—"}</strong><span>个独立 IP · 当前页</span></div>
        <div><strong>{query.data ? number(pageRegions.length) : "—"}</strong><span>个已识别区域 · 当前页</span></div>
      </div>
      <div className={styles.dateToolbar}><DateRangePicker value={range} today={today} onChange={(value) => update(value)} /></div>
      <div className={styles.regions} role="group" aria-label="按当前页区域筛选">
        <button type="button" aria-pressed={!filters.region_id} onClick={() => update({ region_id: "" })}>全部区域</button>
        {pageRegions.map(([id, label]) => <button type="button" key={id} aria-pressed={filters.region_id === id} onClick={() => update({ region_id: id })}>{label}</button>)}
        <span>区域快捷筛选来自当前页</span>
      </div>
      <div className={styles.toolbar}>
        <label className={styles.search}><Search size={18} aria-hidden="true" /><input type="search" aria-label="搜索访问记录" placeholder="搜索 IP、区域、运营商或访问页面…" maxLength={100} value={filters.q} onChange={(e) => update({ q: e.target.value })} /></label>
        <label className={styles.filter}>区域<select aria-label="区域" value={filters.region_id} onChange={(e) => update({ region_id: e.target.value })}><option value="">全部区域</option>{regions.data?.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
        <label className={styles.filter}>来源<select aria-label="来源" value={filters.source} onChange={(e) => update({ source: e.target.value })}><option value="">全部来源</option>{Object.entries(sourceNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <Button variant="ghost" onClick={reset}>重置筛选</Button>
      </div>
      <QueryState loading={query.isPending} error={query.error} empty={query.data?.data.length === 0} emptyText="所选范围内没有匹配的访问记录。" emptyAction={<Button variant="ghost" onClick={reset}>清除访问筛选</Button>} retry={() => void query.refetch()}>
        <div className={styles.tableScroll} role="region" aria-label="访问记录列表" tabIndex={0}><table className={styles.table}>
          <thead><tr>{["访问 IP / 网络", "所属区域", "访问来源", "访问页面", "访问时间", "访问控制"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{rows.map((row) => {
            const timestamp = date(row.occurred_at, true).split(" ");
            return <tr key={row.id}>
              <td><strong className={styles.ip}>{row.ip}</strong><small>{row.network_label || "网络未知"}</small></td>
              <td><span className={styles.regionLabel}>{row.region_label}</span><small>{deviceNames[row.device] || row.device}</small></td>
              <td><span className={styles.source} data-source={row.source}>{sourceNames[row.source] || row.source}</span></td>
              <td><span className={styles.pageTitle} title={row.page_title}>{row.page_title}</span><small className={styles.path} title={row.page_path}>{row.page_path}</small></td>
              <td><time className={styles.time} dateTime={row.occurred_at}>{timestamp[0]}<small>{timestamp.slice(1).join(" ")}</small></time></td>
              <td><div className={styles.controls}><Link to={`/admin/access-rules?scope=ip&ip=${encodeURIComponent(row.ip)}`}>封锁 IP</Link>{regions.data?.some((item) => item.id === row.region_id && item.blockable) && <Link to={`/admin/access-rules?scope=region&region_id=${encodeURIComponent(row.region_id)}`}>封锁区域</Link>}</div>{row.matched_rule_ids.length > 0 && <span className={styles.matched}>命中 {row.matched_rule_ids.length} 条规则</span>}</td>
            </tr>;
          })}</tbody>
        </table></div>
      </QueryState>
      {query.data && <div className={styles.pagination}><Pagination page={page} total={query.data.meta.total} totalPages={query.data.meta.total_pages} onChange={(page) => update({ page }, true)} /></div>}
      <p className={styles.note}>仅提供最近 30 天的访问查询。IP、网络及区域由服务器识别；封锁规则请在左侧“访问规则”中管理。</p>
    </section>
  </div>;
}
