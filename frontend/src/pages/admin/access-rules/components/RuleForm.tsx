import { useRuleMutations } from "../../../../shared/queries/access";
import { useState } from "react";
import type { AccessRule, RuleCreate } from "../../../../shared/api/generated";
import { useRegions } from "../../../../shared/queries/access";
import { ruleSchema } from "../../../../shared/schemas/access";
import { validate } from "../../../../shared/schemas/common";
import { Field } from "../../../../shared/components/ui/field/Field";
import { Button } from "../../../../shared/components/ui/button/Button";
import { ErrorNotice } from "../../../../shared/components/ui/error-notice/ErrorNotice";
import forms from "../../../../shared/styles/forms.module.css";
export function RuleForm({
  item,
  defaults,
  onDone,
}: {
  item?: AccessRule;
  defaults?: Partial<RuleCreate>;
  onDone: () => void;
}) {
  const [value, setValue] = useState<RuleCreate>(() =>
    item
      ? {
          scope: item.scope,
          ip: item.scope === "ip" ? item.target : null,
          region_id: item.scope === "region" ? item.target : null,
          reason: item.reason,
          enabled: item.enabled,
          duration_hours: item.duration_hours,
        }
      : {
          scope: "ip",
          ip: "",
          region_id: null,
          reason: "",
          enabled: true,
          duration_hours: 24,
          ...defaults,
        },
  );
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const regions = useRegions();
  const mutations = useRuleMutations();
  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      const body = validate(ruleSchema, {
        ...value,
        ip: value.scope === "ip" ? value.ip : null,
        region_id: value.scope === "region" ? value.region_id : null,
      });
      if (item)
        await mutations.update.mutateAsync({
          id: item.id,
          body: { ...body, version: item.version },
        });
      else await mutations.create.mutateAsync(body);
      onDone();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <fieldset disabled={busy} className={forms.stack}>
        <Field label="封锁类型">
          <select
            value={value.scope}
            disabled={!!item}
            onChange={(e) =>
              setValue({ ...value, scope: e.target.value as "ip" | "region" })
            }
          >
            <option value="ip">IP 地址</option>
            <option value="region">区域</option>
          </select>
        </Field>
        {value.scope === "ip" ? (
          <Field label="IPv4 / IPv6 地址">
            <input
              disabled={!!item}
              value={value.ip || ""}
              onChange={(e) =>
                setValue({ ...value, ip: e.target.value.trim() })
              }
            />
          </Field>
        ) : (
          <Field label="区域">
            <select
              disabled={!!item}
              value={value.region_id || ""}
              onChange={(e) =>
                setValue({ ...value, region_id: e.target.value || null })
              }
            >
              <option value="">选择区域</option>
              {regions.data
                ?.filter((row) => row.blockable)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
            </select>
          </Field>
        )}
        <Field
          label="有效期"
          hint={item ? "保存会从当前时间重新计算有效期。" : undefined}
        >
          <select
            value={value.duration_hours ?? ""}
            onChange={(e) =>
              setValue({
                ...value,
                duration_hours: e.target.value
                  ? (Number(e.target.value) as 1 | 24 | 168)
                  : null,
              })
            }
          >
            <option value={1}>1 小时</option>
            <option value={24}>24 小时</option>
            <option value={168}>7 天</option>
            <option value="">永久</option>
          </select>
        </Field>
        <Field label="封锁原因">
          <textarea
            value={value.reason}
            maxLength={200}
            onChange={(e) => setValue({ ...value, reason: e.target.value })}
          />
        </Field>
        <label className={forms.checkbox}>
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(e) => setValue({ ...value, enabled: e.target.checked })}
          />
          启用规则
        </label>
      </fieldset>
      <ErrorNotice error={error} />
      <ErrorNotice error={regions.error} />
      <p className={forms.hint}>
        已有规则不能更改封锁对象；如需更改，请新建规则。解除 IP
        后仍可能受区域规则限制。
      </p>
      <div className={forms.actions}>
        <Button loading={busy} onClick={() => void save()}>
          保存规则
        </Button>
      </div>
    </>
  );
}
