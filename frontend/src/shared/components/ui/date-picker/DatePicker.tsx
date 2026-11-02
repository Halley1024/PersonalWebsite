import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { beijingDay } from "../../../utils/date";
import styles from "./DatePicker.module.css";

type Props = {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  clearable?: boolean;
  disabled?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};
const monthNumber = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
const formatMonth = (month: number) => `${String(Math.floor(month / 12)).padStart(4, "0")}-${String(month % 12 + 1).padStart(2, "0")}`;

export function DatePicker({ id, label, value, onChange, min, max, clearable = false, disabled, ...accessibility }: Props) {
  const today = beijingDay();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState((value || today).slice(0, 7));
  const [editingMonth, setEditingMonth] = useState(false);
  const [yearDigits, setYearDigits] = useState("");
  const [monthDigits, setMonthDigits] = useState("");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const calendar = useRef<HTMLDivElement>(null);
  const yearInput = useRef<HTMLInputElement>(null);
  const monthTitle = useRef<HTMLButtonElement>(null);
  const wasEditingMonth = useRef(false);
  const focusDay = useRef<string | null>(null);
  const titleId = useId();
  const hintId = useId();
  const errorId = useId();
  const minimum = min || "0001-01-01";
  const maximum = max || "9999-12-31";
  const monthIndex = monthNumber(month);
  const first = new Date(`${month}-01T00:00:00Z`);
  const last = new Date(first);
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  const blanks = (first.getUTCDay() + 6) % 7;
  const close = () => { setOpen(false); setEditingMonth(false); setError(""); };
  const choose = (day: string) => {
    if (day < minimum || day > maximum) return;
    onChange(day);
    close();
  };
  const clampMonth = (next: string) => next < minimum.slice(0, 7) ? minimum.slice(0, 7) : next > maximum.slice(0, 7) ? maximum.slice(0, 7) : next;
  const moveMonth = (amount: number) => {
    setEditingMonth(false);
    setError("");
    setMonth(clampMonth(formatMonth(Math.max(12, Math.min(119999, monthIndex + amount)))));
  };
  const commitMonth = () => {
    if (!/^\d{1,4}$/.test(yearDigits) || Number(yearDigits) < 1 || !/^\d{1,2}$/.test(monthDigits) || Number(monthDigits) < 1 || Number(monthDigits) > 12) {
      setError("请输入 1 至 9999 的年份和 1 至 12 的月份。");
      return;
    }
    const next = `${yearDigits.padStart(4, "0")}-${monthDigits.padStart(2, "0")}`;
    if (next < minimum.slice(0, 7) || next > maximum.slice(0, 7)) {
      setError(`请选择 ${minimum.slice(0, 7)} 至 ${maximum.slice(0, 7)} 之间的月份。`);
      return;
    }
    setMonth(next);
    setEditingMonth(false);
    setError("");
  };
  useEffect(() => {
    const element = dialog.current;
    if (open && !element?.open) {
      element?.showModal();
      (calendar.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]:not(:disabled)') ?? calendar.current?.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus();
    } else if (!open && element?.open) {
      element.close();
      trigger.current?.focus();
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  useEffect(() => {
    if (editingMonth) { yearInput.current?.focus(); yearInput.current?.select(); }
    else if (wasEditingMonth.current) monthTitle.current?.focus();
    wasEditingMonth.current = editingMonth;
  }, [editingMonth]);
  useEffect(() => {
    if (focusDay.current) {
      calendar.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay.current}"]`)?.focus();
      focusDay.current = null;
    }
  }, [month]);

  return <>
    <button {...accessibility} id={id} ref={trigger} type="button" className={styles.trigger} disabled={disabled}
      aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => {
        setMonth(clampMonth((value || today).slice(0, 7)));
        setOpen(true);
      }}>
      <CalendarDays size={17} aria-hidden="true" /><span>{value || "选择日期"}</span>
    </button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} aria-describedby={hintId} onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
      }}>
      {open && <>
        <header className={styles.heading}><strong id={titleId}>选择{label}</strong><button type="button" aria-label="关闭日历" onClick={close}><X size={18} /></button></header>
        <div className={styles.month}>
          <button type="button" aria-label="上一年" title="上一年" disabled={month.slice(0, 4) <= minimum.slice(0, 4)} onClick={() => moveMonth(-12)}><ChevronsLeft size={18} aria-hidden="true" /></button>
          <button type="button" aria-label="上个月" title="上个月" disabled={month <= minimum.slice(0, 7)} onClick={() => moveMonth(-1)}><ChevronLeft size={18} /></button>
          {editingMonth ? <div className={styles.monthFields} role="group" aria-label="编辑年月"
            onKeyDown={(event) => {
              if (event.key === "Enter") { event.preventDefault(); commitMonth(); }
              if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setEditingMonth(false); setError(""); }
            }}>
            <input ref={yearInput} type="text" inputMode="numeric" pattern="[0-9]{1,4}" maxLength={4} value={yearDigits}
              aria-label="年份" aria-invalid={!!error} aria-describedby={error ? errorId : hintId} placeholder="年份"
              onChange={(event) => { setYearDigits(event.target.value.replace(/[^0-9]/g, "").slice(0, 4)); setError(""); }} />
            <span aria-hidden="true">年</span>
            <input type="text" inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2} value={monthDigits}
              aria-label="月份" aria-invalid={!!error} aria-describedby={error ? errorId : hintId} placeholder="月"
              onChange={(event) => { setMonthDigits(event.target.value.replace(/[^0-9]/g, "").slice(0, 2)); setError(""); }} />
            <span aria-hidden="true">月</span>
          </div> : <button ref={monthTitle} type="button" className={styles.monthTitle} aria-label={`输入年月，当前 ${month}`} title="点击编辑年份和月份" onClick={() => {
            setYearDigits(month.slice(0, 4)); setMonthDigits(String(Number(month.slice(5, 7)))); setEditingMonth(true); setError("");
          }}>
              {first.getUTCFullYear()} 年 {first.getUTCMonth() + 1} 月
            </button>}
          <button type="button" aria-label="下个月" title="下个月" disabled={month >= maximum.slice(0, 7)} onClick={() => moveMonth(1)}><ChevronRight size={18} /></button>
          <button type="button" aria-label="下一年" title="下一年" disabled={month.slice(0, 4) >= maximum.slice(0, 4)} onClick={() => moveMonth(12)}><ChevronsRight size={18} aria-hidden="true" /></button>
        </div>
        {editingMonth && <div className={styles.jump}><span>分别填写年份和月份</span><button type="button" onClick={commitMonth}>跳转</button></div>}
        {error && <p className={styles.error} id={errorId} role="alert">{error}</p>}
        <div className={styles.weekdays} aria-hidden="true">{["一", "二", "三", "四", "五", "六", "日"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className={styles.days} ref={calendar} aria-label={`${month} 日历`} onKeyDown={(event) => {
          const day = (event.target as HTMLElement).dataset.day;
          const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
          if (!day || delta[event.key] === undefined) return;
          event.preventDefault();
          const next = new Date(`${day}T00:00:00Z`);
          next.setUTCDate(next.getUTCDate() + delta[event.key]);
          if (next.getUTCFullYear() < 1 || next.getUTCFullYear() > 9999) return;
          const target = next.toISOString().slice(0, 10);
          if (target < minimum || target > maximum) return;
          if (target.slice(0, 7) !== month) { focusDay.current = target; setMonth(target.slice(0, 7)); }
          else calendar.current?.querySelector<HTMLButtonElement>(`[data-day="${target}"]`)?.focus();
        }}>
          {Array.from({ length: blanks }, (_, index) => <span key={`blank-${index}`} />)}
          {Array.from({ length: last.getUTCDate() }, (_, index) => {
            const day = `${month}-${String(index + 1).padStart(2, "0")}`;
            return <button type="button" key={day} data-day={day} aria-label={day} aria-current={day === today ? "date" : undefined} aria-pressed={day === value}
              disabled={day < minimum || day > maximum} onClick={() => choose(day)}>{index + 1}</button>;
          })}
        </div>
        <footer className={styles.footer}>
          <button type="button" disabled={today < minimum || today > maximum} onClick={() => choose(today)}>今天</button>
          {clearable && <button type="button" onClick={() => { onChange(""); close(); }}>清除日期</button>}
        </footer>
        <p className={styles.hint} id={hintId}>点击顶部年月，分别编辑年份和月份，回车或点击跳转后选择具体日期。</p>
      </>}
    </dialog>
  </>;
}
