/** Date helpers. Dates are plain 'YYYY-MM-DD' strings in Asia/Manila. */
export const TZ = 'Asia/Manila';

export function manilaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function manilaHour(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(now)) % 24;
}
export function addDays(d: string, n: number): string {
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day + n));
  return dt.toISOString().slice(0, 10);
}
export function diffDays(a: string, b: string): number {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}
/** Nights covered by a stay: [check_in, check_out) */
export function nightsOf(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) out.push(d);
  return out;
}
/** ISO timestamp of a Manila local date + HH:MM */
export function manilaDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+08:00`);
}
export function fmtDate(d: string, lang: 'en' | 'fil' = 'en') {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(lang === 'fil' ? 'fil-PH' : 'en-PH', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-PH', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
export const peso = (n: number) => '₱' + Math.round(n).toLocaleString('en-PH');
