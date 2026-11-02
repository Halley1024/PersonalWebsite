import { useLayoutEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { SkillGroup } from "../../../api/generated";
import { Field } from "../../ui/field/Field";
import styles from "./SkillGroupEditor.module.css";
export function SkillGroupEditor({ group, index, onChange, onRemove }: {
  group: SkillGroup;
  index: number;
  onChange: (group: SkillGroup) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const chips = useRef<(HTMLButtonElement | null)[]>([]);
  const dragFrom = useRef<number | null>(null);
  const original = useRef("");
  const pendingFocus = useRef<{ index: number; edit: boolean } | null>(null);
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    const node = target.edit ? inputs.current[target.index] : chips.current[target.index];
    node?.focus();
    if (target.edit) inputs.current[target.index]?.select();
    pendingFocus.current = null;
  }, [group.items, editing]);
  const startEditing = (position: number) => {
    original.current = group.items[position];
    pendingFocus.current = { index: position, edit: true };
    setEditing(position);
  };
  const finishEditing = (position: number) => {
    pendingFocus.current = { index: position, edit: false };
    setEditing(null);
  };
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= group.items.length) return;
    const items = [...group.items];
    const [item] = items.splice(from, 1);
    items.splice(to, 0, item);
    pendingFocus.current = { index: to, edit: false };
    setEditing(null);
    onChange({ ...group, items });
  };
  const endDrag = () => { dragFrom.current = null; setDragging(null); setDropTarget(null); };
  return <section className={styles.group} aria-label={`技能分组 ${index + 1}`}>
    <header className={styles.header}>
      <span>技能组 {String(index + 1).padStart(2, "0")}</span>
      <button type="button" className={styles.removeGroup} aria-label={`移除第 ${index + 1} 个技能分组`} title="移除分组" onClick={onRemove}><X size={18} aria-hidden="true" /></button>
    </header>
    <Field label="分组名称"><input maxLength={50} value={group.title} placeholder="例如：开发语言" onChange={(event) => onChange({ ...group, title: event.target.value })} /></Field>
    <div className={styles.skills}>
      <div className={styles.label}><span>技能项目</span><small>{group.items.length} / 20 项</small></div>
      <div className={styles.items}>
        {group.items.map((item, skillIndex) => <div className={styles.item} key={skillIndex} draggable={editing !== skillIndex}
          data-dragging={dragging === skillIndex || undefined} data-drop={dropTarget === skillIndex || undefined}
          onDragStart={(event) => {
            if (editing === skillIndex) { event.preventDefault(); return; }
            dragFrom.current = skillIndex; setDragging(skillIndex);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", `${index}:${skillIndex}`);
          }} onDragEnd={endDrag} onDragOver={(event) => {
            if (dragFrom.current === null) return;
            event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTarget(skillIndex);
          }} onDrop={(event) => {
            if (dragFrom.current === null) return;
            event.preventDefault(); move(dragFrom.current, skillIndex); endDrag();
          }}>
          {editing === skillIndex ? <>
            <input ref={(node) => { inputs.current[skillIndex] = node; }} aria-label={`第 ${index + 1} 组技能 ${skillIndex + 1}`} placeholder="输入技能" maxLength={50} value={item}
              onChange={(event) => onChange({ ...group, items: group.items.map((text, i) => i === skillIndex ? event.target.value : text) })}
              onBlur={(event) => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) setEditing(null); }}
              onKeyDown={(event) => {
                if (event.key === "Enter") { event.preventDefault(); finishEditing(skillIndex); }
                if (event.key === "Escape") {
                  event.preventDefault(); onChange({ ...group, items: group.items.map((text, i) => i === skillIndex ? original.current : text) }); finishEditing(skillIndex);
                }
              }} />
            <button type="button" className={styles.removeItem} aria-label={`移除第 ${index + 1} 组技能 ${skillIndex + 1}`} title="移除技能"
              onBlur={(event) => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) setEditing(null); }}
              onClick={() => { setEditing(null); pendingFocus.current = { index: Math.max(0, skillIndex - 1), edit: false }; onChange({ ...group, items: group.items.filter((_, i) => i !== skillIndex) }); }}><X size={15} aria-hidden="true" /></button>
          </> : <button ref={(node) => { chips.current[skillIndex] = node; }} type="button" className={styles.skill} aria-label={`第 ${index + 1} 组技能 ${skillIndex + 1}`} title="双击修改，拖拽调整顺序"
            onDoubleClick={() => startEditing(skillIndex)} onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "F2") { event.preventDefault(); startEditing(skillIndex); }
              if (event.altKey && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
                event.preventDefault(); move(skillIndex, skillIndex + (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1));
              }
            }}>{item || "未填写技能"}</button>}
        </div>)}
        <button type="button" className={styles.add} aria-label={`为第 ${index + 1} 组添加技能`} title="添加技能" disabled={group.items.length >= 20}
          onClick={() => { original.current = ""; pendingFocus.current = { index: group.items.length, edit: true }; setEditing(group.items.length); onChange({ ...group, items: [...group.items, ""] }); }}><Plus size={18} aria-hidden="true" /></button>
      </div>
      <p className={styles.hint}>点击 ＋ 添加技能，双击技能可修改和删除，拖拽可调整顺序。键盘可按 Enter 编辑，Alt + 方向键排序。</p>
    </div>
  </section>;
}
