/**
 * Business logic. Every function takes the DB object and mutates it in place.
 * The browser store (lib/store.tsx) wraps each call: load → apply → save.
 * In production these become server routes / Postgres transactions.
 */
import type { Aircon, Booking, BookingStatus, CalendarBlock, DB, Lang, Payment, PaymentType } from './types';
import { addDays, diffDays, manilaDateTime, manilaHour, manilaToday, nightsOf } from './dates';
import { allotment, calculatePrice, undeclaredCharge } from './pricing';
import { amountsFor } from './money';
import { Ctx, notifyGuest, notifyOwner } from './notify';
import { parseIcal } from './ical';

export class BookingError extends Error {}
export const rid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
export const token = () => Array.from({ length: 3 }, () => Math.random().toString(36).slice(2, 10)).join('');

export const ACTIVE: BookingStatus[] = ['pending_payment', 'payment_submitted', 'confirmed', 'checked_in'];

export function audit(db: DB, ctx: Ctx, action: string, entity: string, entity_id: string, data?: unknown) {
  db.audit_log.unshift({ id: rid(), actor_id: ctx.actor, action, entity, entity_id, data: data ?? null, created_at: ctx.now.toISOString() });
}

// ---------- Availability ----------
/** Returns the booking/block occupying a night, if any. */
export function nightOccupant(db: DB, night: string, ignoreBookingId?: string): Booking | CalendarBlock | null {
  for (const b of db.bookings) {
    if (b.id === ignoreBookingId || !ACTIVE.includes(b.status)) continue;
    if (b.check_in_date <= night && night < b.check_out_date) return b;
  }
  for (const k of db.calendar_blocks) {
    if (k.converted_booking_id) continue; // converted Airbnb block is represented by its booking
    if (k.start_date <= night && night < k.end_date) return k;
  }
  return null;
}
export function isRangeFree(db: DB, checkIn: string, checkOut: string, ignoreBookingId?: string) {
  return nightsOf(checkIn, checkOut).every((n) => !nightOccupant(db, n, ignoreBookingId));
}
/** Public calendar: only booked/available. */
export function publicAvailability(db: DB, from: string, days: number): Record<string, 'booked' | 'available' | 'past'> {
  const today = manilaToday();
  const out: Record<string, 'booked' | 'available' | 'past'> = {};
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    out[d] = d < today ? 'past' : nightOccupant(db, d) ? 'booked' : 'available';
  }
  return out;
}

// ---------- Holds ----------
export function expireHolds(db: DB, ctx: Ctx) {
  let n = 0;
  for (const b of db.bookings) {
    if (b.status === 'pending_payment' && b.hold_expires_at && new Date(b.hold_expires_at) <= ctx.now) {
      b.status = 'expired'; b.updated_at = ctx.now.toISOString(); n++;
      audit(db, ctx, 'hold_expired', 'booking', b.id);
      notifyGuest(db, ctx, b, 'hold_expired', ['email', 'sms']);
    }
  }
  return n;
}

// ---------- Create booking ----------
export interface BookingInput {
  check_in_date: string; check_out_date: string;
  declared_guests: number; infants: number; aircon_choice: Aircon | null;
  booker_name: string; booker_mobile: string; booker_email: string;
  guest_names: string[]; infant_names?: string[];
  id_file: { name: string; dataUrl: string } | null;
  special_requests: string; language: Lang;
  agree_rules: boolean; agree_penalty: boolean; agree_expectations: boolean; agree_privacy: boolean;
  honeypot?: string; ip?: string;
}

export function normalizeMobile(m: string): string | null {
  const d = m.replace(/[\s-]/g, '');
  if (/^09\d{9}$/.test(d)) return '+63' + d.slice(1);
  if (/^\+639\d{9}$/.test(d)) return d;
  if (/^639\d{9}$/.test(d)) return '+' + d;
  return null;
}

export function validateBookingInput(db: DB, inp: BookingInput, now: Date): string[] {
  const e: string[] = [];
  const s = db.settings;
  const today = manilaToday(now);
  if (inp.honeypot) e.push('spam');
  if (!inp.check_in_date || !inp.check_out_date) e.push('dates_required');
  else {
    if (inp.check_in_date < today) e.push('date_past');
    if (diffDays(inp.check_in_date, inp.check_out_date) < 1) e.push('min_one_night');
  }
  if (!Number.isInteger(inp.declared_guests) || inp.declared_guests < 1 || inp.declared_guests > s.max_guests) e.push('guest_count');
  if (inp.infants < 0) e.push('infants');
  if (inp.declared_guests <= 3 && !inp.aircon_choice) e.push('aircon_required');
  if (!inp.booker_name.trim()) e.push('booker_name');
  if (!normalizeMobile(inp.booker_mobile)) e.push('mobile');
  if (!/^\S+@\S+\.\S+$/.test(inp.booker_email)) e.push('email');
  if (inp.guest_names.length !== inp.declared_guests || inp.guest_names.some((n) => n.trim().split(/\s+/).length < 2)) e.push('guest_names');
  if (!inp.id_file) e.push('id_required');
  if (!inp.special_requests.trim()) e.push('special_requests');
  if (!inp.agree_rules || !inp.agree_penalty || !inp.agree_expectations || !inp.agree_privacy) e.push('agreements');
  return e;
}

export function createBooking(db: DB, ctx: Ctx, inp: BookingInput): Booking {
  expireHolds(db, ctx);
  const errs = validateBookingInput(db, inp, ctx.now);
  if (errs.length) throw new BookingError(errs.join(','));
  // Atomic availability check + insert (single critical section — see lib/lock.ts).
  if (!isRangeFree(db, inp.check_in_date, inp.check_out_date)) throw new BookingError('dates_taken');
  const nights = diffDays(inp.check_in_date, inp.check_out_date);
  const price = calculatePrice(db.settings, inp.declared_guests, nights);
  const al = allotment(inp.declared_guests, inp.aircon_choice);
  const nowIso = ctx.now.toISOString();
  const id = rid();
  db.seq.booking += 1;
  const ym = manilaToday(ctx.now).slice(2, 7).replace('-', '');
  const b: Booking = {
    id, code: `TRC-${ym}-${String(db.seq.booking).padStart(4, '0')}`, source: 'direct', status: 'pending_payment',
    check_in_date: inp.check_in_date, check_out_date: inp.check_out_date, nights,
    declared_guests: inp.declared_guests, infants: inp.infants, aircon_choice: al.aircon, rooms_allowed: al.rooms,
    price_breakdown: price, total_amount: price.total, extra_charges: [],
    booker_name: inp.booker_name.trim(), booker_mobile: normalizeMobile(inp.booker_mobile)!, booker_email: inp.booker_email.trim(),
    special_requests: inp.special_requests.trim(), language: inp.language,
    rules_accepted_at: nowIso, rules_accepted_ip: inp.ip ?? 'unknown', privacy_consent_at: nowIso,
    guest_token: token(), hold_expires_at: new Date(ctx.now.getTime() + db.settings.hold_hours * 3600_000).toISOString(),
    decline_reason: null, actual_guests: null, undeclared_guests: 0, pending_change: null, cancel_requested_at: null,
    guests: [
      ...inp.guest_names.map((n, i) => ({ id: rid(), full_name: n.trim(), is_booker: i === 0, age_group: 'adult' as const })),
      ...Array.from({ length: inp.infants }, (_, i) => ({ id: rid(), full_name: inp.infant_names?.[i]?.trim() || `Infant ${i + 1}`, is_booker: false, age_group: 'infant' as const })),
    ],
    created_at: nowIso, updated_at: nowIso,
  };
  db.bookings.push(b);
  db.guest_ids.push({ id: rid(), booking_id: id, storage_path: inp.id_file!.dataUrl, file_name: inp.id_file!.name, uploaded_at: nowIso, delete_after: null });
  audit(db, ctx, 'booking_created', 'booking', id, { code: b.code });
  notifyGuest(db, ctx, b, 'booking_created', ['email', 'sms']);
  return b;
}

// ---------- Guest access ----------
export function findByToken(db: DB, code: string, t: string | null): Booking | null {
  const b = db.bookings.find((x) => x.code === code);
  if (!b || !t || b.guest_token !== t) return null;
  return b;
}
function guestBooking(db: DB, code: string, t: string) {
  const b = findByToken(db, code, t);
  if (!b) throw new BookingError('invalid_link');
  return b;
}
export function beforeCutoff(db: DB, b: Booking, now: Date) {
  return manilaDateTime(b.check_in_date, db.settings.checkin_time).getTime() - now.getTime() > db.settings.edit_cutoff_hours * 3600_000;
}

export function submitPaymentProof(db: DB, ctx: Ctx, code: string, t: string, ref: string, proof: string | null) {
  expireHolds(db, ctx);
  const b = guestBooking(db, code, t);
  if (b.status !== 'pending_payment') throw new BookingError('not_awaiting_payment');
  if (!ref.trim() || !proof) throw new BookingError('ref_and_proof_required');
  db.payments.push({ id: rid(), booking_id: b.id, type: 'downpayment', method: 'gcash', amount: db.settings.downpayment_amount, reference_no: ref.trim(), proof_path: proof, status: 'submitted', recorded_by: 'guest', verified_by: null, verified_at: null, created_at: ctx.now.toISOString() });
  b.status = 'payment_submitted'; b.hold_expires_at = null; b.updated_at = ctx.now.toISOString();
  audit(db, { ...ctx, actor: 'guest' }, 'payment_submitted', 'booking', b.id, { ref });
  notifyGuest(db, ctx, b, 'payment_received', ['email']);
  notifyOwner(db, ctx, b, 'payment', `Payment proof uploaded for ${b.code} (${b.booker_name}, ${b.check_in_date}, ${b.declared_guests} guests). Please verify & approve.`, ['email', 'sms']);
}

export function requestGuestChange(db: DB, ctx: Ctx, code: string, t: string, newCount: number, names: string[]) {
  const b = guestBooking(db, code, t);
  if (!['payment_submitted', 'confirmed'].includes(b.status)) throw new BookingError('not_editable');
  if (!beforeCutoff(db, b, ctx.now)) throw new BookingError('past_cutoff');
  if (newCount < b.declared_guests) throw new BookingError('cannot_reduce');
  if (newCount > db.settings.max_guests) throw new BookingError('guest_count');
  if (names.length !== newCount || names.some((n) => n.trim().split(/\s+/).length < 2)) throw new BookingError('guest_names');
  if (newCount === b.declared_guests) {
    // name edits only: apply directly
    const adults = b.guests.filter((g) => g.age_group !== 'infant');
    adults.forEach((g, i) => (g.full_name = names[i].trim()));
    audit(db, { ...ctx, actor: 'guest' }, 'guest_names_edited', 'booking', b.id);
    return;
  }
  b.pending_change = { declared_guests: newCount, names: names.map((n) => n.trim()), requested_at: ctx.now.toISOString() };
  b.updated_at = ctx.now.toISOString();
  audit(db, { ...ctx, actor: 'guest' }, 'guest_change_requested', 'booking', b.id, b.pending_change);
  notifyGuest(db, ctx, b, 'guests_changed', ['email']);
  notifyOwner(db, ctx, b, 'guest_change', `${b.code} wants to change guests ${b.declared_guests} → ${newCount}. Needs approval.`, ['email', 'sms']);
}

export function requestCancel(db: DB, ctx: Ctx, code: string, t: string) {
  const b = guestBooking(db, code, t);
  b.cancel_requested_at = ctx.now.toISOString();
  audit(db, { ...ctx, actor: 'guest' }, 'cancel_requested', 'booking', b.id);
  notifyOwner(db, ctx, b, 'cancel_request', `${b.code} (${b.booker_name}) requested cancellation for ${b.check_in_date}.`, ['email', 'sms']);
}

// ---------- Admin ----------
function get(db: DB, id: string) {
  const b = db.bookings.find((x) => x.id === id);
  if (!b) throw new BookingError('not_found');
  return b;
}

function applyGuestCount(db: DB, b: Booking, count: number, names?: string[]) {
  b.declared_guests = count;
  const al = allotment(count, b.aircon_choice === 'both' ? 'sala' : b.aircon_choice);
  b.rooms_allowed = al.rooms; b.aircon_choice = al.aircon;
  if (b.source !== 'airbnb') { b.price_breakdown = calculatePrice(db.settings, count, b.nights); b.total_amount = b.price_breakdown.total; }
  if (names) {
    const infants = b.guests.filter((g) => g.age_group === 'infant');
    b.guests = [...names.map((n, i) => ({ id: rid(), full_name: n, is_booker: i === 0, age_group: 'adult' as const })), ...infants];
  }
}

export function verifyPayment(db: DB, ctx: Ctx, paymentId: string) {
  const p = db.payments.find((x) => x.id === paymentId);
  if (!p) throw new BookingError('not_found');
  p.status = 'verified'; p.verified_by = ctx.actor; p.verified_at = ctx.now.toISOString();
  audit(db, ctx, 'payment_verified', 'payment', p.id, { amount: p.amount });
}

export function rejectPayment(db: DB, ctx: Ctx, paymentId: string, reason: string) {
  const p = db.payments.find((x) => x.id === paymentId);
  if (!p) throw new BookingError('not_found');
  p.status = 'rejected'; p.reject_reason = reason;
  const b = get(db, p.booking_id);
  if (b.status === 'payment_submitted' && p.type === 'downpayment') {
    b.status = 'pending_payment';
    b.hold_expires_at = new Date(ctx.now.getTime() + db.settings.hold_hours * 3600_000).toISOString();
  }
  audit(db, ctx, 'payment_rejected', 'payment', p.id, { reason });
  notifyGuest(db, ctx, b, 'payment_rejected', ['email', 'sms'], { reason });
}

export function approveBooking(db: DB, ctx: Ctx, id: string) {
  const b = get(db, id);
  if (!['payment_submitted', 'pending_payment'].includes(b.status)) throw new BookingError('cannot_approve');
  const dp = db.payments.find((p) => p.booking_id === id && p.type === 'downpayment');
  if (!dp || dp.status !== 'verified') throw new BookingError('verify_payment_first');
  b.status = 'confirmed'; b.hold_expires_at = null; b.updated_at = ctx.now.toISOString();
  issueInvoice(db, ctx, b);
  audit(db, ctx, 'booking_approved', 'booking', id);
  notifyGuest(db, ctx, b, 'approved', ['email', 'sms']);
}

export function declineBooking(db: DB, ctx: Ctx, id: string, reason: string) {
  const b = get(db, id);
  const paid = db.payments.some((p) => p.booking_id === id && p.status === 'verified' && p.type !== 'refund');
  b.status = paid ? 'refund_due' : 'declined'; b.decline_reason = reason; b.hold_expires_at = null; b.updated_at = ctx.now.toISOString();
  audit(db, ctx, 'booking_declined', 'booking', id, { reason });
  notifyGuest(db, ctx, b, 'declined', ['email', 'sms'], { reason, refund: paid ? '1' : '' });
}

export function cancelBooking(db: DB, ctx: Ctx, id: string, refund: boolean) {
  const b = get(db, id);
  b.status = refund && amountsFor(db, b).paid > 0 ? 'refund_due' : 'cancelled';
  b.updated_at = ctx.now.toISOString();
  audit(db, ctx, 'booking_cancelled', 'booking', id, { refund });
}

export function markRefunded(db: DB, ctx: Ctx, id: string, amount: number, ref: string) {
  const b = get(db, id);
  db.payments.push({ id: rid(), booking_id: id, type: 'refund', method: 'gcash', amount, reference_no: ref, proof_path: null, status: 'verified', recorded_by: ctx.actor, verified_by: ctx.actor, verified_at: ctx.now.toISOString(), created_at: ctx.now.toISOString() });
  b.status = b.decline_reason ? 'declined' : 'cancelled';
  audit(db, ctx, 'refunded', 'booking', id, { amount, ref });
}

export function resolveGuestChange(db: DB, ctx: Ctx, id: string, approve: boolean) {
  const b = get(db, id);
  if (!b.pending_change) return;
  if (approve) {
    const before = b.declared_guests;
    applyGuestCount(db, b, b.pending_change.declared_guests, b.pending_change.names);
    if (b.status === 'confirmed') issueInvoice(db, ctx, b);
    audit(db, ctx, 'guest_change_approved', 'booking', id, { from: before, to: b.declared_guests });
  } else audit(db, ctx, 'guest_change_rejected', 'booking', id);
  b.pending_change = null; b.updated_at = ctx.now.toISOString();
}

export function adminEditBooking(db: DB, ctx: Ctx, id: string, patch: { check_in_date?: string; check_out_date?: string; declared_guests?: number; aircon_choice?: Aircon; infants?: number }) {
  const b = get(db, id);
  const ci = patch.check_in_date ?? b.check_in_date, co = patch.check_out_date ?? b.check_out_date;
  if (diffDays(ci, co) < 1) throw new BookingError('min_one_night');
  if (!isRangeFree(db, ci, co, b.id)) throw new BookingError('dates_taken');
  const before = { ci: b.check_in_date, co: b.check_out_date, g: b.declared_guests };
  b.check_in_date = ci; b.check_out_date = co; b.nights = diffDays(ci, co);
  if (patch.aircon_choice) b.aircon_choice = patch.aircon_choice;
  if (patch.infants !== undefined) b.infants = patch.infants;
  const count = patch.declared_guests ?? b.declared_guests;
  const names = b.guests.filter((g) => g.age_group !== 'infant').map((g) => g.full_name);
  while (names.length < count) names.push(`Guest ${names.length + 1} (name pending)`);
  applyGuestCount(db, b, count, names.slice(0, count));
  b.updated_at = ctx.now.toISOString();
  if (b.status === 'confirmed' || b.status === 'checked_in') issueInvoice(db, ctx, b);
  audit(db, ctx, 'booking_edited', 'booking', id, { before, after: patch });
}

// ---------- Invoices ----------
export function issueInvoice(db: DB, ctx: Ctx, b: Booking) {
  const existing = db.invoices.find((i) => i.booking_id === b.id);
  if (existing) { existing.revision += 1; existing.revised_at = ctx.now.toISOString(); return existing; }
  const year = manilaToday(ctx.now).slice(0, 4);
  db.seq.invoice[year] = (db.seq.invoice[year] ?? 0) + 1;
  const inv = { id: rid(), booking_id: b.id, number: `TRC-INV-${year}-${String(db.seq.invoice[year]).padStart(4, '0')}`, revision: 0, issued_at: ctx.now.toISOString(), revised_at: null };
  db.invoices.push(inv);
  return inv;
}

// ---------- Staff ----------
function record(db: DB, b: Booking) {
  let r = db.checkin_records.find((x) => x.booking_id === b.id);
  if (!r) { r = { id: rid(), booking_id: b.id, actual_guests: null, actual_infants: null, checklist: {}, checkout_checklist: {}, notes: '', checked_in_at: null, checked_out_at: null, staff_id: '' }; db.checkin_records.push(r); }
  return r;
}

/** Headcount at check-in or any time during the stay. Adds undeclared charges once per extra person. */
export function setHeadcount(db: DB, ctx: Ctx, id: string, actual: number, infants: number) {
  const b = get(db, id);
  const r = record(db, b);
  r.actual_guests = actual; r.actual_infants = infants; r.staff_id = ctx.actor;
  const u = undeclaredCharge(db.settings, b.declared_guests, actual);
  const newly = u.undeclared - b.undeclared_guests;
  b.actual_guests = actual;
  if (newly > 0) {
    b.extra_charges.push({ label: `Undeclared guest penalty × ${newly} (₱${db.settings.undeclared_penalty.toLocaleString()} each)`, amount: newly * db.settings.undeclared_penalty });
    b.extra_charges.push({ label: `Extra guest fee × ${newly} (₱${db.settings.extra_guest_fee.toLocaleString()} each)`, amount: newly * db.settings.extra_guest_fee });
    b.undeclared_guests = u.undeclared;
    audit(db, ctx, 'undeclared_guests', 'booking', id, { declared: b.declared_guests, actual, added: newly, amount: newly * u.per });
    notifyOwner(db, ctx, b, 'undeclared', `${b.code}: ${newly} undeclared guest(s) (declared ${b.declared_guests}, actual ${actual}). ₱${(newly * u.per).toLocaleString()} added.`, ['sms']);
  }
  b.updated_at = ctx.now.toISOString();
  return { undeclared: u.undeclared, newly, amount: newly > 0 ? newly * u.per : 0 };
}

export function recordPayment(db: DB, ctx: Ctx, id: string, p: { type: PaymentType; method: Payment['method']; amount: number; reference_no: string; proof: string | null }) {
  const b = get(db, id);
  if (!(p.amount > 0)) throw new BookingError('amount');
  db.payments.push({ id: rid(), booking_id: b.id, type: p.type, method: p.method, amount: p.amount, reference_no: p.reference_no, proof_path: p.proof, status: 'verified', recorded_by: ctx.actor, verified_by: ctx.actor, verified_at: ctx.now.toISOString(), created_at: ctx.now.toISOString() });
  audit(db, ctx, 'payment_recorded', 'booking', id, { type: p.type, amount: p.amount, method: p.method });
}

export function checkIn(db: DB, ctx: Ctx, id: string, checklist: Record<string, boolean>, notes: string) {
  const b = get(db, id);
  if (b.status !== 'confirmed') throw new BookingError('not_confirmed');
  const r = record(db, b);
  if (r.actual_guests === null) throw new BookingError('headcount_required');
  r.checklist = checklist; r.notes = notes; r.checked_in_at = ctx.now.toISOString(); r.staff_id = ctx.actor;
  b.status = 'checked_in'; b.updated_at = ctx.now.toISOString();
  if (b.undeclared_guests > 0) issueInvoice(db, ctx, b);
  audit(db, ctx, 'checked_in', 'booking', id, { checklist });
}

export function checkOut(db: DB, ctx: Ctx, id: string, checklist: Record<string, boolean>, notes: string, extra: { label: string; amount: number } | null) {
  const b = get(db, id);
  if (b.status !== 'checked_in') throw new BookingError('not_checked_in');
  const r = record(db, b);
  if (extra && extra.amount > 0) b.extra_charges.push(extra);
  r.checkout_checklist = checklist; r.notes = [r.notes, notes].filter(Boolean).join('\n'); r.checked_out_at = ctx.now.toISOString();
  b.status = 'checked_out'; b.updated_at = ctx.now.toISOString();
  const del = addDays(manilaToday(ctx.now), db.settings.data_retention_days);
  db.guest_ids.filter((g) => g.booking_id === id).forEach((g) => (g.delete_after = del));
  audit(db, ctx, 'checked_out', 'booking', id, { checklist, extra });
  notifyGuest(db, ctx, b, 'checked_out', ['email']);
}

// ---------- Calendar / Airbnb ----------
export function addBlock(db: DB, ctx: Ctx, start: string, end: string, reason: 'maintenance' | 'personal') {
  if (diffDays(start, end) < 1) throw new BookingError('min_one_night');
  if (!isRangeFree(db, start, end)) throw new BookingError('dates_taken');
  const k: CalendarBlock = { id: rid(), start_date: start, end_date: end, reason, external_uid: null, source: 'manual' };
  db.calendar_blocks.push(k);
  audit(db, ctx, 'block_added', 'calendar_block', k.id, k);
}
export function removeBlock(db: DB, ctx: Ctx, blockId: string) {
  db.calendar_blocks = db.calendar_blocks.filter((k) => k.id !== blockId);
  audit(db, ctx, 'block_removed', 'calendar_block', blockId);
}

/** Upsert Airbnb events by UID; remove blocks whose UID disappeared (cancelled on Airbnb). */
export function importAirbnbIcal(db: DB, ctx: Ctx, ics: string) {
  try {
    const events = parseIcal(ics);
    const seen = new Set<string>();
    let added = 0, updated = 0, removed = 0;
    for (const e of events) {
      seen.add(e.uid);
      const ex = db.calendar_blocks.find((k) => k.source === 'airbnb_ical' && k.external_uid === e.uid);
      if (ex) {
        if (ex.start_date !== e.start || ex.end_date !== e.end) { ex.start_date = e.start; ex.end_date = e.end; updated++; }
      } else {
        db.calendar_blocks.push({ id: rid(), start_date: e.start, end_date: e.end, reason: 'airbnb', external_uid: e.uid, source: 'airbnb_ical', summary: e.summary, converted_booking_id: null });
        added++;
      }
    }
    const gone = db.calendar_blocks.filter((k) => k.source === 'airbnb_ical' && k.external_uid && !seen.has(k.external_uid));
    for (const k of gone) {
      if (k.converted_booking_id) { const b = db.bookings.find((x) => x.id === k.converted_booking_id); if (b && b.status === 'confirmed') b.status = 'cancelled'; }
      removed++;
    }
    db.calendar_blocks = db.calendar_blocks.filter((k) => !gone.includes(k));
    db.sync = { last_synced_at: ctx.now.toISOString(), last_error: null };
    audit(db, ctx, 'airbnb_sync', 'calendar_block', '-', { added, updated, removed });
    return { added, updated, removed };
  } catch (err) {
    db.sync = { last_synced_at: db.sync.last_synced_at, last_error: String((err as Error).message) };
    throw err;
  }
}

export function convertAirbnbBlock(db: DB, ctx: Ctx, blockId: string, d: { name: string; mobile: string; email: string; guests: number; infants: number; payout: number; aircon: Aircon }) {
  const k = db.calendar_blocks.find((x) => x.id === blockId);
  if (!k || k.source !== 'airbnb_ical') throw new BookingError('not_found');
  const al = allotment(d.guests, d.aircon);
  const nowIso = ctx.now.toISOString();
  db.seq.booking += 1;
  const ym = manilaToday(ctx.now).slice(2, 7).replace('-', '');
  const b: Booking = {
    id: rid(), code: `TRC-${ym}-${String(db.seq.booking).padStart(4, '0')}`, source: 'airbnb', status: 'confirmed',
    check_in_date: k.start_date, check_out_date: k.end_date, nights: diffDays(k.start_date, k.end_date),
    declared_guests: d.guests, infants: d.infants, aircon_choice: al.aircon, rooms_allowed: al.rooms,
    price_breakdown: null, total_amount: d.payout, extra_charges: [], airbnb_payout: d.payout,
    booker_name: d.name, booker_mobile: normalizeMobile(d.mobile) ?? d.mobile, booker_email: d.email, special_requests: '(Airbnb)', language: 'en',
    rules_accepted_at: null, rules_accepted_ip: null, privacy_consent_at: null, guest_token: token(), hold_expires_at: null,
    decline_reason: null, actual_guests: null, undeclared_guests: 0, pending_change: null, cancel_requested_at: null,
    guests: [{ id: rid(), full_name: d.name, is_booker: true, age_group: 'adult' }, ...Array.from({ length: d.guests - 1 }, (_, i) => ({ id: rid(), full_name: `Guest ${i + 2} (name pending)`, is_booker: false, age_group: 'adult' as const }))],
    block_uid: k.external_uid ?? undefined, created_at: nowIso, updated_at: nowIso,
  };
  db.bookings.push(b);
  k.converted_booking_id = b.id;
  if (d.payout > 0) db.payments.push({ id: rid(), booking_id: b.id, type: 'airbnb_payout', method: 'airbnb', amount: d.payout, reference_no: 'Airbnb', proof_path: null, status: 'verified', recorded_by: ctx.actor, verified_by: ctx.actor, verified_at: nowIso, created_at: nowIso });
  audit(db, ctx, 'airbnb_converted', 'booking', b.id, d);
  return b;
}

// ---------- Scheduled jobs ----------
export function runReminders(db: DB, ctx: Ctx) {
  if (manilaHour(ctx.now) < 9) return 0;
  const tomorrow = addDays(manilaToday(ctx.now), 1);
  let n = 0;
  for (const b of db.bookings) {
    if (b.status !== 'confirmed' || b.check_in_date !== tomorrow) continue;
    if (db.message_log.some((m) => m.booking_id === b.id && m.template === 'reminder')) continue;
    notifyGuest(db, ctx, b, 'reminder', ['email', 'sms']); n++;
  }
  return n;
}

/** Delete ID images and payment-proof images N days after check-out. Names are kept. */
export function privacyPurge(db: DB, ctx: Ctx) {
  const today = manilaToday(ctx.now);
  let n = 0;
  for (const b of db.bookings) {
    if (b.status !== 'checked_out') continue;
    const r = db.checkin_records.find((x) => x.booking_id === b.id);
    const out = r?.checked_out_at ? manilaToday(new Date(r.checked_out_at)) : b.check_out_date;
    if (addDays(out, db.settings.data_retention_days) > today) continue;
    const before = db.guest_ids.length;
    db.guest_ids = db.guest_ids.filter((g) => g.booking_id !== b.id);
    n += before - db.guest_ids.length;
    for (const p of db.payments) if (p.booking_id === b.id && p.proof_path) { p.proof_path = null; n++; }
  }
  if (n) audit(db, ctx, 'privacy_purge', 'storage', '-', { deleted: n });
  return n;
}

export function runAllJobs(db: DB, ctx: Ctx) {
  return { expired: expireHolds(db, ctx), reminders: runReminders(db, ctx), purged: privacyPurge(db, ctx) };
}
