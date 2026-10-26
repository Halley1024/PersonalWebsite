import { useRuleMutations } from "../../../shared/queries/access";
import { useState } from "react";
import type { AccessRule, RuleCreate } from "../../../shared/api/generated";
import { useRules } from "../../../shared/queries/access";
import { useUrlFilters } from "../../../shared/hooks/useUrlFilters";
import { useSeo } from "../../../shared/hooks/useSeo";
import { date } from "../../../shared/utils/date";
import { PageHeading } from "../../../shared/components/ui/page-heading/PageHeading";
import { Button } from "../../../shared/components/ui/button/Button";
import { QueryState } from "../../../shared/components/ui/query-state/QueryState";
import { Pagination } from "../../../shared/components/ui/pagination/Pagination";
import { Badge } from "../../../shared/components/ui/badge/Badge";
import { Dialog } from "../../../shared/components/ui/dialog/Dialog";
import { ConfirmDialog } from "../../../shared/components/ui/confirm-dialog/ConfirmDialog";
import { RuleForm } from "./components/RuleForm";
import forms from "../../../shared/styles/forms.module.css";
import table from "../../../shared/styles/table.module.css";
import styles from "./Page.module.css";
export default function Page() {
  const { params, page, update } = useUrlFilters();
  const query = useRules({
    page,
    page_size: 20,
    scope: params.get("scope") || "",
    state: params.get("state") || "",
    q: params.get("q") || "",
  });
  const [form, setForm] = useState<
    { item?: AccessRule; defaults?: Partial<RuleCreate> } | undefined
  >(() =>
    params.get("ip")
      ? { defaults: { scope: "ip", ip: params.get("ip") } }
      : params.get("region_id")
        ? { defaults: { scope: "region", region_id: params.get("region_id") } }
        : undefined,
  );
  const [action, setAction] = useState<{ item: AccessRule; remove: boolean }>();
  const mutations = useRuleMutations();
  useSeo("访问规则");
  const close = () => {
    setForm(undefined);
    if (params.has("ip") || params.has("region_id"))
      update({ ip: "", region_id: "" });
  };
  return (
    <div className={styles.page}>
      <PageHeading
        eyebrow="ACCESS / RULES"
        title="访问规则"
        description="规则由服务器执行，支持 IP 与区域封锁。解除单个 IP 不会覆盖区域规则。"
        actions={<Button onClick={() => setForm({})}>＋ 新增规则</Button>}
      />
      <div className={forms.toolbar}>
        <input
          aria-label="搜索规则"
          placeholder="搜索对象或原因…"
          maxLength={100}
          value={params.get("q") || ""}
          onChange={(e) => update({ q: e.target.value })}
        />
        <select
          aria-label="封锁类型"
          value={params.get("scope") || ""}
          onChange={(e) => update({ scope: e.target.value })}
        >
          <option value="">全部类型</option>
          <option value="ip">IP</option>
          <option value="region">区域</option>
        </select>
        <select
          aria-label="规则状态"
          value={params.get("state") || ""}
          onChange={(e) => update({ state: e.target.value })}
        >
          <option value="">全部状态</option>
          <option value="active">生效中</option>
          <option value="expired">已过期</option>
          <option value="disabled">已禁用</option>
        </select>
      </div>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        empty={query.data?.data.length === 0}
        emptyText="暂无匹配的封锁规则。"
      >
        <div className={table.scroll}>
          <table className={table.table}>
            <thead>
              <tr>
                <th>封锁对象</th>
                <th>原因</th>
                <th>有效期</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.data.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.target_label}</strong>
                    <small>
                      {row.scope} · {row.target}
                    </small>
                  </td>
                  <td>{row.reason || "—"}</td>
                  <td>
                    {row.expires_at ? date(row.expires_at, true) : "永久"}
                  </td>
                  <td>
                    <Badge
                      value={
                        !row.enabled
                          ? "disabled"
                          : row.effective
                            ? "active"
                            : "expired"
                      }
                    />
                  </td>
                  <td>
                    <div className={table.actions}>
                      <button onClick={() => setForm({ item: row })}>
                        编辑 / 续期
                      </button>
                      {row.enabled && (
                        <button
                          onClick={() =>
                            setAction({ item: row, remove: false })
                          }
                        >
                          禁用
                        </button>
                      )}
                      <button
                        className={table.danger}
                        onClick={() => setAction({ item: row, remove: true })}
                      >
                        删除
                      </button>
                    </div>
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
      <Dialog
        open={!!form}
        title={form?.item ? "编辑封锁规则" : "新增封锁规则"}
        onClose={close}
      >
        {form && (
          <RuleForm
            key={form.item?.id || "new"}
            item={form.item}
            defaults={form.defaults}
            onDone={close}
          />
        )}
      </Dialog>
      <ConfirmDialog
        open={!!action}
        title={action?.remove ? "永久删除规则" : "禁用规则"}
        description="操作成功后将更新服务器规则。目标仍可能命中其他有效规则。"
        danger={action?.remove}
        onClose={() => setAction(undefined)}
        onConfirm={async () => {
          if (!action) return;
          const row = action.item;
          if (action.remove)
            await mutations.remove.mutateAsync({
              id: row.id,
              version: row.version,
            });
          else
            await mutations.update.mutateAsync({
              id: row.id,
              body: {
                scope: row.scope,
                ip: row.scope === "ip" ? row.target : null,
                region_id: row.scope === "region" ? row.target : null,
                reason: row.reason,
                enabled: false,
                duration_hours: row.duration_hours,
                version: row.version,
              },
            });
        }}
      />
    </div>
  );
}
