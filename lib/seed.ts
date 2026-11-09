import type { Aircon, Booking, BookingGuest, BookingStatus, DB, Source } from './types';
import { DEFAULT_SETTINGS } from './settings';
import { SEED_CONTENT, SEED_PROMOS } from './content';
import { addDays, manilaToday } from './dates';
import { allotment, calculatePrice } from './pricing';

export const DB_VERSION = 3;

export function emptyDB(): DB {
  return {
    version: DB_VERSION, settings: structuredClone(DEFAULT_SETTINGS), bookings: [], guest_ids: [], payments: [], calendar_blocks: [],
    checkin_records: [], invoices: [], message_log: [], content_pages: structuredClone(SEED_CONTENT), promos: structuredClone(SEED_PROMOS),
    audit_log: [], sync: { last_synced_at: null, last_error: null }, seq: { booking: 0, invoice: {} },
  };
}

const FIRST = ['Maria', 'Jose', 'Ana', 'Mark', 'Kristine', 'Paolo', 'Liza', 'Carlo', 'Joy', 'Rafael', 'Bea', 'Miguel', 'Grace', 'Enzo', 'Camille', 'Andrei', 'Nica', 'Ramon', 'Trish', 'Jun'];
const LAST = ['Santos', 'Reyes', 'Cruz', 'Bautista', 'Garcia', 'Mendoza', 'Dela Cruz', 'Ramos', 'Villanueva', 'Aquino', 'Castillo', 'Navarro', 'Torres', 'Flores', 'Domingo'];

/** Placeholder "ID photo" (SVG data URL) so the admin ID viewer has something to show. */
const idImage = (name: string) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="260"><rect width="420" height="260" rx="16" fill="#dcebe2"/><rect x="20" y="20" width="110" height="140" rx="8" fill="#9bb8a7"/><text x="150" y="60" font-family="sans-serif" font-size="14" fill="#245039">REPUBLIC OF THE PHILIPPINES</text><text x="150" y="90" font-family="sans-serif" font-size="12" fill="#245039">DEMO DRIVER'S LICENSE</text><text x="150" y="130" font-family="sans-serif" font-size="18" font-weight="bold" fill="#14301f">${name.replace(/&/g, '')}</text><text x="20" y="220" font-family="monospace" font-size="14" fill="#245039">N01-23-456789 · SAMPLE ONLY</text></svg>`);
const proofImage = (ref: string, amt: number) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="260" height="420"><rect width="260" height="420" fill="#0b5ed7"/><rect x="15" y="60" width="230" height="300" rx="12" fill="#fff"/><text x="130" y="40" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#fff" font-weight="bold">GCash</text><text x="130" y="120" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#333">Sent via GCash</text><text x="130" y="170" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="bold" fill="#0b5ed7">PHP ${amt.toLocaleString()}.00</text><text x="130" y="230" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#555">Ref No. ${ref}</text><text x="130" y="330" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#999">DEMO SCREENSHOT</text></svg>`);

export function demoAirbnbIcal(today: string) {
  const ev = (uid: string, s: number, e: number) => `BEGIN:VEVENT\r\nDTEND;VALUE=DATE:${addDays(today, e).replace(/-/g, '')}\r\nDTSTART;VALUE=DATE:${addDays(today, s).replace(/-/g, '')}\r\nUID:${uid}@airbnb.com\r\nSUMMARY:Reserved\r\nEND:VEVENT`;
  return ['BEGIN:VCALENDAR', 'PRODID:-//Airbnb Inc//Hosting Calendar 1.0//EN', 'VERSION:2.0', ev('demo-abnb-1', 5, 7), ev('demo-abnb-2', 12, 13), ev('demo-abnb-3', 24, 26), ev('demo-abnb-4', 40, 42), 'END:VCALENDAR'].join('\r\n');
}

export function seedDB(now = new Date()): DB {
  const db = emptyDB();
  const today = manilaToday(now);
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const person = () => `${pick(FIRST)} ${pick(LAST)}`;
  const iso = (d: string, hh = 10) => new Date(`${d}T${String(hh).padStart(2, '0')}:00:00+08:00`).toISOString();
  let n = 0;

  const make = (o: { ci: string; nights: number; guests: number; infants?: number; source: Source; status: BookingStatus; aircon?: Aircon; payout?: number; undeclared?: number; requests?: string; lang?: 'en' | 'fil' }) => {
    n++;
    const id = `seed${n}`;
    const name = person();
    const co = addDays(o.ci, o.nights);
    const al = allotment(o.guests, o.aircon ?? (rnd() > 0.5 ? 'sala' : 'bedroom'));
    const price = o.source === 'airbnb' ? null : calculatePrice(db.settings, o.guests, o.nights);
    const c0 = addDays(o.ci, -Math.ceil(rnd() * 20) - 2);
    const created = c0 < today ? c0 : today;
    const ym = created.slice(2, 7).replace('-', '');
    const b: Booking = {
      id, code: `TRC-${ym}-${String(n).padStart(4, '0')}`, source: o.source, status: o.status, check_in_date: o.ci, check_out_date: co, nights: o.nights,
      declared_guests: o.guests, infants: o.infants ?? 0, aircon_choice: al.aircon, rooms_allowed: al.rooms, price_breakdown: price,
      total_amount: price?.total ?? o.payout ?? 0, extra_charges: [], airbnb_payout: o.payout,
      booker_name: name, booker_mobile: `+63917${String(1000000 + n * 7919).slice(-7)}`, booker_email: `${name.split(' ')[0].toLowerCase()}${n}@example.com`,
      special_requests: o.requests ?? pick(['None', 'Wala po', 'Early check-in if possible', "Celebrating my mom's birthday", 'Will bring a cake, may ref po ba?', 'None, thank you!']),
      language: o.lang ?? (rnd() > 0.5 ? 'fil' : 'en'), rules_accepted_at: o.source === 'airbnb' ? null : iso(created, 9), rules_accepted_ip: o.source === 'airbnb' ? null : `112.198.${n % 250}.${(n * 7) % 250}`,
      privacy_consent_at: o.source === 'airbnb' ? null : iso(created, 9), guest_token: `demo${n}tok`,
      hold_expires_at: o.status === 'pending_payment' ? new Date(now.getTime() + 2 * 3600_000).toISOString() : null,
      decline_reason: o.status === 'declined' ? 'Requested a hotel-style setup we cannot provide.' : null, actual_guests: null, undeclared_guests: 0, pending_change: null, cancel_requested_at: null,
      guests: [name, ...Array.from({ length: o.guests - 1 }, () => person())].map((g, i) => ({ id: `${id}g${i}`, full_name: g, is_booker: i === 0, age_group: 'adult' as BookingGuest['age_group'] })).concat(Array.from({ length: o.infants ?? 0 }, (_, i) => ({ id: `${id}i${i}`, full_name: `Baby ${name.split(' ').slice(-1)[0]}`, is_booker: false, age_group: 'infant' as const }))),
      created_at: iso(created, 9), updated_at: iso(created, 9),
    };
    if (o.source === 'airbnb') { b.guests = b.guests.map((g, i) => (i === 0 ? g : { ...g, full_name: i < 2 ? g.full_name : `Guest ${i + 1} (name pending)` })); }
    db.bookings.push(b);
    db.seq.booking = n;
    if (o.source !== 'airbnb') db.guest_ids.push({ id: `${id}id`, booking_id: id, storage_path: idImage(name), file_name: 'id.jpg', uploaded_at: iso(created, 9), delete_after: o.status === 'checked_out' ? addDays(co, 30) : null });

    const pay = (type: 'downpayment' | 'balance' | 'penalty' | 'extra_guest' | 'airbnb_payout', amount: number, day: string, status: 'submitted' | 'verified' = 'verified', method: 'gcash' | 'cash' | 'airbnb' = 'gcash') => {
      const ref = String(1000000000000 + Math.floor(rnd() * 8999999999999)).slice(0, 13);
      db.payments.push({ id: `${id}p${db.payments.length}`, booking_id: id, type, method, amount, reference_no: method === 'gcash' ? ref : method === 'airbnb' ? 'Airbnb' : '', proof_path: method === 'gcash' && type === 'downpayment' ? proofImage(ref, amount) : null, status, recorded_by: type === 'downpayment' ? 'guest' : 'staff', verified_by: status === 'verified' ? 'admin' : null, verified_at: status === 'verified' ? iso(day, 11) : null, created_at: iso(day, 10) });
    };
    const settled = ['confirmed', 'checked_in', 'checked_out', 'refund_due'].includes(o.status);
    if (o.source === 'airbnb') {
      if (o.payout && ['confirmed', 'checked_in', 'checked_out'].includes(o.status)) pay('airbnb_payout', o.payout, o.ci < today ? addDays(o.ci, 1) : today, 'verified', 'airbnb');
    } else if (o.status === 'payment_submitted') pay('downpayment', 1000, today, 'submitted');
    else if (settled) pay('downpayment', 1000, created);
    if (['checked_in', 'checked_out'].includes(o.status) || (settled && o.source !== 'airbnb' && o.status !== 'confirmed' && o.status !== 'refund_due')) {
      const actual = o.guests + (o.undeclared ?? 0);
      if (o.undeclared) {
        b.extra_charges.push({ label: `Undeclared guest penalty × ${o.undeclared} (₱2,000 each)`, amount: 2000 * o.undeclared }, { label: `Extra guest fee × ${o.undeclared} (₱500 each)`, amount: 500 * o.undeclared });
        b.undeclared_guests = o.undeclared;
      }
      b.actual_guests = actual;
      db.checkin_records.push({ id: `${id}r`, booking_id: id, actual_guests: actual, actual_infants: o.infants ?? 0, checklist: Object.fromEntries(db.settings.checkin_checklist.map((c) => [c, true])), checkout_checklist: o.status === 'checked_out' ? Object.fromEntries(db.settings.checkout_checklist.map((c) => [c, true])) : {}, notes: o.undeclared ? `${o.undeclared} extra guests arrived, penalty collected.` : '', checked_in_at: iso(o.ci, 14), checked_out_at: o.status === 'checked_out' ? iso(co, 12) : null, staff_id: 'staff' });
      if (o.source !== 'airbnb' && price) pay('balance', price.balance_at_checkin, o.ci, 'verified', rnd() > 0.5 ? 'cash' : 'gcash');
      if (o.undeclared && o.status === 'checked_out') pay('penalty', 2500 * o.undeclared, o.ci, 'verified', 'cash');
    }
    if (['confirmed', 'checked_in', 'checked_out'].includes(o.status)) {
      const y = (o.status === 'confirmed' ? created : o.ci).slice(0, 4);
      db.seq.invoice[y] = (db.seq.invoice[y] ?? 0) + 1;
      db.invoices.push({ id: `${id}inv`, booking_id: id, number: `TRC-INV-${y}-${String(db.seq.invoice[y]).padStart(4, '0')}`, revision: 0, issued_at: iso(created, 12), revised_at: null });
    }
    return b;
  };

  // ~11 months of history (checked-out stays) for the revenue chart
  for (let back = 330; back > 35; back -= 3 + Math.floor(rnd() * 6)) {
    const g = 1 + Math.floor(rnd() * 6);
    make({ ci: addDays(today, -back), nights: 1 + (rnd() > 0.75 ? 1 : 0), guests: g, infants: rnd() > 0.8 ? 1 : 0, source: rnd() > 0.55 ? 'airbnb' : 'direct', status: 'checked_out', payout: 3000 + Math.round(rnd() * 25) * 100, undeclared: rnd() > 0.88 ? 1 + Math.floor(rnd() * 2) : 0 });
  }
  // Last ~month, current, next 2 months (handcrafted spread)
  const plan: Parameters<typeof make>[0][] = [
    { ci: addDays(today, -30), nights: 2, guests: 4, source: 'direct', status: 'checked_out' },
    { ci: addDays(today, -26), nights: 1, guests: 3, source: 'direct', status: 'checked_out', undeclared: 3 },
    { ci: addDays(today, -22), nights: 1, guests: 2, source: 'airbnb', status: 'checked_out', payout: 3150 },
    { ci: addDays(today, -19), nights: 2, guests: 6, infants: 1, source: 'direct', status: 'checked_out' },
    { ci: addDays(today, -15), nights: 1, guests: 2, source: 'direct', status: 'declined' },
    { ci: addDays(today, -12), nights: 1, guests: 5, source: 'airbnb', status: 'checked_out', payout: 4600 },
    { ci: addDays(today, -9), nights: 1, guests: 3, source: 'direct', status: 'checked_out' },
    { ci: addDays(today, -6), nights: 2, guests: 2, source: 'direct', status: 'expired' },
    { ci: addDays(today, -5), nights: 1, guests: 4, source: 'direct', status: 'checked_out', undeclared: 1 },
    { ci: addDays(today, -3), nights: 2, guests: 2, source: 'airbnb', status: 'checked_out', payout: 6100 },
    { ci: addDays(today, -1), nights: 2, guests: 3, infants: 1, source: 'direct', status: 'checked_in', aircon: 'bedroom' },
    // today check-in (after yesterday's guest leaves? no: 1 booking per night — yesterday's 2-night stay leaves tomorrow)
    { ci: addDays(today, 1), nights: 1, guests: 3, source: 'direct', status: 'confirmed', aircon: 'sala', requests: 'Wala po, salamat!' },
    { ci: addDays(today, 2), nights: 2, guests: 5, infants: 1, source: 'direct', status: 'confirmed' },
    { ci: addDays(today, 8), nights: 1, guests: 2, source: 'direct', status: 'payment_submitted', requests: 'Anniversary namin, okay lang ba mag-decorate ng balloons?' },
    { ci: addDays(today, 10), nights: 1, guests: 3, source: 'direct', status: 'pending_payment', aircon: 'bedroom' },
    { ci: addDays(today, 15), nights: 2, guests: 4, source: 'direct', status: 'confirmed' },
    { ci: addDays(today, 18), nights: 1, guests: 7, source: 'direct', status: 'payment_submitted', requests: 'We expect 5-star hotel cleanliness, plush towels and a bathtub please.' },
    { ci: addDays(today, 21), nights: 1, guests: 2, source: 'direct', status: 'refund_due' },
    { ci: addDays(today, 30), nights: 2, guests: 6, source: 'direct', status: 'confirmed' },
    { ci: addDays(today, 34), nights: 1, guests: 3, source: 'direct', status: 'confirmed' },
    { ci: addDays(today, 47), nights: 3, guests: 4, source: 'direct', status: 'confirmed' },
    { ci: addDays(today, 55), nights: 1, guests: 2, source: 'direct', status: 'confirmed' },
  ];
  for (const p of plan) make(p);

  // today: a checkout (the -1 booking leaves tomorrow) — add a guest change request on one booking
  const change = db.bookings.find((b) => b.check_in_date === addDays(today, 15));
  if (change) change.pending_change = { declared_guests: 5, names: [...change.guests.filter((g) => g.age_group !== 'infant').map((g) => g.full_name), 'Lola Remedios Santos'], requested_at: now.toISOString() };
  const refund = db.bookings.find((b) => b.status === 'refund_due');
  if (refund) refund.decline_reason = 'Dates needed for urgent maintenance — sorry!';

  // Airbnb iCal blocks: one converted into a booking
  const ics = demoAirbnbIcal(today);
  for (const [i, uid] of ['demo-abnb-1', 'demo-abnb-2', 'demo-abnb-3', 'demo-abnb-4'].entries()) {
    const [s, e] = [[5, 7], [12, 13], [24, 26], [40, 42]][i];
    db.calendar_blocks.push({ id: `blk${i}`, start_date: addDays(today, s), end_date: addDays(today, e), reason: 'airbnb', external_uid: `${uid}@airbnb.com`, source: 'airbnb_ical', summary: 'Reserved', converted_booking_id: null });
  }
  const conv = make({ ci: addDays(today, 5), nights: 2, guests: 4, source: 'airbnb', status: 'confirmed', payout: 7800, lang: 'en' });
  db.calendar_blocks[0].converted_booking_id = conv.id;
  conv.block_uid = 'demo-abnb-1@airbnb.com';
  db.calendar_blocks.push({ id: 'blkm', start_date: addDays(today, 27), end_date: addDays(today, 28), reason: 'maintenance', external_uid: null, source: 'manual' });
  db.sync = { last_synced_at: new Date(now.getTime() - 12 * 60000).toISOString(), last_error: null };
  db.settings.airbnb_ical_import_url = 'https://www.airbnb.com/calendar/ical/000000.ics?s=DEMO';
  void ics;

  // A couple of message log entries incl. a failure to demo "resend"
  db.message_log.push({ id: 'm1', booking_id: db.bookings.find((b) => b.status === 'pending_payment')?.id ?? null, channel: 'sms', template: 'booking_created', to: '+639170000000', body: 'TRC: Send ₱1,000 GCash in 3h to hold dates…', status: 'failed', error: 'Semaphore: invalid number (demo)', sent_at: now.toISOString() });
  return db;
}
