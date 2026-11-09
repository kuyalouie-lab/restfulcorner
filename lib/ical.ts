import type { DB } from './types';

export interface IcalEvent { uid: string; start: string; end: string; summary: string }

const toDate = (v: string) => {
  const m = v.match(/(\d{4})(\d{2})(\d{2})/);
  if (!m) throw new Error(`Bad date: ${v}`);
  return `${m[1]}-${m[2]}-${m[3]}`;
};

/** Minimal RFC 5545 parser for Airbnb exports (all-day VEVENTs). */
export function parseIcal(text: string): IcalEvent[] {
  if (!/BEGIN:VCALENDAR/.test(text)) throw new Error('Not an iCal file (missing BEGIN:VCALENDAR)');
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const out: IcalEvent[] = [];
  let cur: Partial<IcalEvent> | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT' && cur) {
      if (cur.uid && cur.start) out.push({ uid: cur.uid, start: cur.start, end: cur.end ?? cur.start, summary: cur.summary ?? '' });
      cur = null;
    } else if (cur) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const key = line.slice(0, i).split(';')[0].toUpperCase(), val = line.slice(i + 1).trim();
      if (key === 'UID') cur.uid = val;
      else if (key === 'DTSTART') cur.start = toDate(val);
      else if (key === 'DTEND') cur.end = toDate(val);
      else if (key === 'SUMMARY') cur.summary = val;
    }
  }
  return out.filter((e) => e.end > e.start);
}

const ics = (d: string) => d.replace(/-/g, '');
const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1');
const fold = (l: string) => (l.length <= 74 ? l : l.match(/.{1,74}/g)!.join('\r\n '));

/** Export feed: direct + manual bookings and manual blocks (no guest details). Airbnb imports it. */
export function buildIcal(db: DB, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The Restful Corner//Booking//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:The Restful Corner (direct)'];
  const ev = (uid: string, s: string, e: string, summary: string) =>
    L.push('BEGIN:VEVENT', `UID:${uid}@therestfulcorner`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ics(s)}`, `DTEND;VALUE=DATE:${ics(e)}`, fold(`SUMMARY:${esc(summary)}`), 'END:VEVENT');
  for (const b of db.bookings) {
    if (b.source === 'airbnb') continue;
    if (!['pending_payment', 'payment_submitted', 'confirmed', 'checked_in'].includes(b.status)) continue;
    ev(b.id, b.check_in_date, b.check_out_date, 'Reserved (direct booking)');
  }
  for (const k of db.calendar_blocks) if (k.source === 'manual') ev(k.id, k.start_date, k.end_date, 'Not available');
  L.push('END:VCALENDAR');
  return L.join('\r\n') + '\r\n';
}
