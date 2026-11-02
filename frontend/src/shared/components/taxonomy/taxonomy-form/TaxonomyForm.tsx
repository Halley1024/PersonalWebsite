import { useTaxonomyMutations } from "../../../queries/taxonomy";
import { useState } from "react";
import {
  type TaxonomyType,
  type TaxonomyRow,
} from "../../../api/taxonomy";
import type { Kind } from "../../../api/content";
import { Field } from "../../ui/field/Field";
import { Button } from "../../ui/button/Button";
import { ErrorNotice } from "../../ui/error-notice/ErrorNotice";
import forms from "../../../styles/forms.module.css";
export function TaxonomyForm({
  type,
  kind,
  item,
  onDone,
  onCancel,
  onBusyChange,
}: {
  type: TaxonomyType;
  kind: Kind;
  item?: TaxonomyRow;
  onDone: (item?: TaxonomyRow) => void;
  onCancel?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [name, setName] = useState(item?.name || "");
  const [slug, setSlug] = useState(item?.slug || "");
  const [order, setOrder] = useState(
    item && "sort_order" in item ? item.sort_order : 0,
  );
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const mutations = useTaxonomyMutations(type);
  async function save() {
    setError(undefined);
    if (!name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setError(new Error("请输入名称及合法的英文 slug"));
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    try {
      const body = {
        name: name.trim(),
        slug,
        ...(type === "categories" ? { sort_order: order } : {}),
      };
      const result = item
        ? await mutations.update.mutateAsync({
          id: item.id,
          body: {
            ...body,
            version: item.version,
          },
        })
        : await mutations.create.mutateAsync({ ...body, kind });
      onDone(result.data);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <>
      <fieldset disabled={busy} className={forms.stack}>
        <Field label="名称">
          <input
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="slug" hint="小写英文、数字和连字符，同类型下唯一">
          <input
            maxLength={100}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </Field>
        {type === "categories" && (
          <Field label="排序值">
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
            />
          </Field>
        )}
      </fieldset>
      <ErrorNotice error={error} />
      <div className={forms.actions}>
        {onCancel && <Button variant="ghost" disabled={busy} onClick={onCancel}>取消</Button>}
        <Button loading={busy} onClick={() => void save()}>
          保存
        </Button>
      </div>
    </>
  );
}
