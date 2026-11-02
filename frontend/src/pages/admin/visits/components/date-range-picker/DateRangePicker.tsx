import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { shiftDay } from "./dates";
import styles from "./DateRangePicker.module.css";
type Range = { start_date: string; end_date: string };
export function DateRangePicker({ value, today, onChange }: { value: Range; today: string; onChange: (range: Range) => void }) {
  const minimum = shiftDay(today, -29);
  const [active, setActive] = useState<keyof Range | null>(null);
  const [month, setMonth] = useState(today.slice(0, 7));
  const root = useRef<HTMLDivElement>(null);
  const calendar = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setActive(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.body.style.overflow = previousOverflow;
    };
  }, [active]);
  useEffect(() => {
    if (active) (calendar.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]:not(:disabled)') ?? calendar.current?.querySelector<HTMLButtonElement>('button[data-day]:not(:disabled)'))?.focus();
  }, [active, month]);
  const close = () => { setActive(null); trigger.current?.focus(); };
  const choose = (day: string) => {
    if (!active || day < minimum || day > today) return;
    onChange(active === "start_date"
      ? { start_date: day, end_date: day > value.end_date ? day : value.end_date }
      : { start_date: day < value.start_date ? day : value.start_date, end_date: day });
    close();
  };
  const moveMonth = (amount: number) => {
    const date = new Date(`${month}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + amount);
    setMonth(date.toISOString().slice(0, 7));
  };
  const first = new Date(`${month}-01T00:00:00Z`);
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const blanks = (first.getUTCDay() + 6) % 7;
  return <div className={styles.root} ref={root} onKeyDown={(event) => {
    if (event.key === "Escape") close();
    if (active && event.key === "Tab") {
      const buttons = root.current?.querySelectorAll<HTMLButtonElement>('[role="dialog"] button:not(:disabled)');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }}>
    <div className={styles.fields}>
      {([['start_date', '开始日期'], ['end_date', '结束日期']] as const).map(([key, label]) => <div className={styles.field} key={key}>
        <span id={`visit-${key}-label`}>{label}</span>
        <button type="button" aria-label={`${label} ${value[key]}`} aria-haspopup="dialog" aria-expanded={active === key} className={active === key ? styles.open : ""}
          onClick={(event) => { trigger.current = event.currentTarget; setMonth(value[key].slice(0, 7)); setActive(active === key ? null : key); }}>
          <CalendarDays size={17} aria-hidden="true" /><span>{value[key]}</span>
        </button>
      </div>)}
      <div className={styles.presets} aria-label="快捷日期范围">
        {[[1, "今天"], [7, "最近 7 天"], [30, "最近 30 天"]].map(([days, label]) => <button key={days} type="button" aria-pressed={value.end_date === today && value.start_date === shiftDay(today, 1 - Number(days))}
          onClick={() => { onChange({ start_date: shiftDay(today, 1 - Number(days)), end_date: today }); setActive(null); }}>{label}</button>)}
      </div>
    </div>
    <p className={styles.hint}>北京时间 · 可查询 {minimum} 至 {today}，含今天共 30 天。</p>
    {active && <div className={styles.backdrop} onClick={(event) => { if (event.target === event.currentTarget) close(); }}><div className={styles.popover} role="dialog" aria-modal="true" aria-label={`选择${active === "start_date" ? "开始" : "结束"}日期`}>
      <div className={styles.heading}><strong>{active === "start_date" ? "开始日期" : "结束日期"}</strong><button type="button" aria-label="关闭日历" onClick={close}><X size={18} /></button></div>
      <div className={styles.month}><button type="button" aria-label="上个月" disabled={month <= minimum.slice(0, 7)} onClick={() => moveMonth(-1)}><ChevronLeft size={18} /></button>
        <strong aria-live="polite">{first.getUTCFullYear()} 年 {first.getUTCMonth() + 1} 月</strong>
        <button type="button" aria-label="下个月" disabled={month >= today.slice(0, 7)} onClick={() => moveMonth(1)}><ChevronRight size={18} /></button></div>
      <div className={styles.weekdays} aria-hidden="true">{['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className={styles.days} ref={calendar} onKeyDown={(event) => {
        const day = (event.target as HTMLElement).dataset.day;
        const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        if (!day || delta[event.key] === undefined) return;
        event.preventDefault();
        const target = shiftDay(day, delta[event.key]);
        if (target < minimum || target > today) return;
        if (target.slice(0, 7) !== month) setMonth(target.slice(0, 7));
        requestAnimationFrame(() => calendar.current?.querySelector<HTMLButtonElement>(`[data-day="${target}"]`)?.focus());
      }}>
        {Array.from({ length: blanks }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: count }, (_, index) => {
          const day = `${month}-${String(index + 1).padStart(2, '0')}`;
          return <button type="button" key={day} data-day={day} aria-label={day} aria-current={day === today ? "date" : undefined} aria-pressed={day === value[active]}
            data-in-range={day >= value.start_date && day <= value.end_date || undefined} disabled={day < minimum || day > today} onClick={() => choose(day)}>{index + 1}</button>;
        })}
      </div><p className={styles.hint}>灰色日期不可选，支持方向键移动，Esc 关闭。</p>
    </div></div>}
  </div>;
}
