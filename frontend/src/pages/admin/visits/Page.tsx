import { Link } from "react-router-dom";
import { useVisits } from "../../../shared/queries/analytics";
import { useRegions } from "../../../shared/queries/access";
import { useUrlFilters } from "../../../shared/hooks/useUrlFilters";
import { useSeo } from "../../../shared/hooks/useSeo";
import { date } from "../../../shared/utils/date";
import { PageHeading } from "../../../shared/components/ui/page-heading/PageHeading";
import { Button } from "../../../shared/components/ui/button/Button";
import { QueryState } from "../../../shared/components/ui/query-state/QueryState";
import { Pagination } from "../../../shared/components/ui/pagination/Pagination";
import forms from "../../../shared/styles/forms.module.css";
import table from "../../../shared/styles/table.module.css";
import styles from "./Page.module.css";
const sourceNames: Record<string, string> = {
  direct: "直接访问",
  github: "GitHub",
  search: "搜索引擎",
  bilibili: "Bilibili",
  other: "其他",
};
export default function Page() {
  const { params, page, update } = useUrlFilters();
  const filters = {
    page,
    page_size: 20,
    q: params.get("q") || "",
    start_date: params.get("start_date") || "",
    end_date: params.get("end_date") || "",
    source: params.get("source") || "",
    region_id: params.get("region_id") || "",
  };
  const query = useVisits(filters);
  const regions = useRegions();
  useSeo("访问明细");
  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="ANALYTICS / VISITORS"
        title="访问明细"
        description="查看真实访问记录；时间以北京时间显示，IP 与区域由服务器识别。"
      />
      <div className={forms.toolbar}>
        <input
          type="search"
          aria-label="搜索访问记录"
          placeholder="搜索 IP、区域或页面…"
          maxLength={100}
          value={filters.q}
          onChange={(e) => update({ q: e.target.value })}
        />
        <select
          aria-label="来源"
          value={filters.source}
          onChange={(e) => update({ source: e.target.value })}
        >
          <option value="">全部来源</option>
          {Object.entries(sourceNames).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="区域"
          value={filters.region_id}
          onChange={(e) => update({ region_id: e.target.value })}
        >
          <option value="">全部区域</option>
          {regions.data?.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.dates}>
        <label>
          开始日期
          <input
            type="date"
            value={filters.start_date}
            onChange={(e) => update({ start_date: e.target.value })}
          />
        </label>
        <label>
          结束日期
          <input
            type="date"
            value={filters.end_date}
            onChange={(e) => update({ end_date: e.target.value })}
          />
        </label>
        <Button
          variant="ghost"
          onClick={() =>
            update({
              q: "",
              start_date: "",
              end_date: "",
              source: "",
              region_id: "",
            })
          }
        >
          重置筛选
        </Button>
        <span>默认最近 7 天，查询范围最多 30 天。</span>
      </div>
      <QueryState
        loading={query.isPending}
        error={query.error}
        empty={query.data?.data.length === 0}
        emptyText="所选范围内没有匹配的访问记录。"
        retry={() => void query.refetch()}
      >
        <div className={table.scroll}>
          <table className={table.table}>
            <thead>
              <tr>
                <th>访问 IP / 网络</th>
                <th>区域</th>
                <th>来源 / 设备</th>
                <th>页面</th>
                <th>时间</th>
                <th>访问控制</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.data.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong className={table.mono}>{row.ip}</strong>
                    <small>{row.network_label || "网络未知"}</small>
                  </td>
                  <td>{row.region_label}</td>
                  <td>
                    {sourceNames[row.source]}
                    <small>{row.device}</small>
                  </td>
                  <td>
                    {row.page_title}
                    <small>{row.page_path}</small>
                  </td>
                  <td>{date(row.occurred_at, true)}</td>
                  <td>
                    <div className={table.actions}>
                      <Link
                        to={`/admin/access-rules?scope=ip&ip=${encodeURIComponent(row.ip)}`}
                      >
                        封锁 IP
                      </Link>
                      {regions.data?.some(
                        (item) => item.id === row.region_id && item.blockable,
                      ) && (
                        <Link
                          to={`/admin/access-rules?scope=region&region_id=${encodeURIComponent(row.region_id)}`}
                        >
                          封锁区域
                        </Link>
                      )}
                    </div>
                    {row.matched_rule_ids.length > 0 && (
                      <small>命中 {row.matched_rule_ids.length} 条规则</small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryState>
      {query.data && (
        <Pagination
          page={page}
          total={query.data.meta.total}
          totalPages={query.data.meta.total_pages}
          onChange={(page) => update({ page }, true)}
        />
      )}
    </div>
  );
}
