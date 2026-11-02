export const shiftDay = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
export function validDay(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function visitRange(start: string | null, end: string | null, today: string) {
  const minimum = shiftDay(today, -29);
  const clamp = (day: string) => day < minimum ? minimum : day > today ? today : day;
  const end_date = validDay(end) ? clamp(end) : today;
  const start_date = validDay(start) ? clamp(start) : clamp(shiftDay(end_date, -6));
  return { start_date: start_date > end_date ? end_date : start_date, end_date };
}
