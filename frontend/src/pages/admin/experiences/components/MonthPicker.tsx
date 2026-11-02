import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog } from "../../../../shared/components/ui/dialog/Dialog";
import { beijingDay } from "../../../../shared/utils/date";
import styles from "./MonthPicker.module.css";
export function MonthPicker({ id, value, onChange, disabled, min, label, ...accessibility }: {
  id?: string; value: string; onChange: (value: string) => void; disabled?: boolean; min?: string; label: string;
  "aria-describedby"?: string; "aria-invalid"?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(beijingDay().slice(0, 4)));
  const current = beijingDay().slice(0, 7);
  return <>
    <button {...accessibility} id={id} type="button" className={styles.trigger} disabled={disabled} aria-label={label} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { setYear(Number((value || min || current).slice(0, 4))); setOpen(true); }}>
      <CalendarDays size={17} aria-hidden="true" /><span>{value || "选择月份"}</span>
    </button>
    <Dialog open={open} title={`选择${label}`} onClose={() => setOpen(false)}>
      <div className={styles.calendar}>
        <div className={styles.year}>
          <button type="button" aria-label="上一年" disabled={year <= 1} onClick={() => setYear(year - 1)}><ChevronLeft size={18} /></button>
          <select aria-label="年份" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {Array.from({ length: Math.min(9999, year + 20) - Math.max(1, year - 100) + 1 }, (_, i) => Math.max(1, year - 100) + i).map((item) => <option key={item} value={item}>{item} 年</option>)}
          </select>
          <button type="button" aria-label="下一年" disabled={year >= 9999} onClick={() => setYear(year + 1)}><ChevronRight size={18} /></button>
        </div>
        <div className={styles.months}>{Array.from({ length: 12 }, (_, i) => {
          const month = `${String(year).padStart(4, "0")}-${String(i + 1).padStart(2, "0")}`;
          return <button type="button" key={month} aria-label={month} aria-pressed={value === month} aria-current={month === current ? "date" : undefined} disabled={!!min && month < min}
            onClick={() => { onChange(month); setOpen(false); }}>{i + 1} 月</button>;
        })}</div>
        <p>按北京时间选择月份{min ? `，不得早于 ${min}` : ""}。</p>
      </div>
    </Dialog>
  </>;
}
