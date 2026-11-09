import type { Booking, DB, Payment } from './types';
import { calculatePrice } from './pricing';
import { manilaToday } from './dates';

const BILL_TYPES: Payment['type'][] = ['downpayment', 'balance', 'penalty', 'extra_guest', 'airbnb_payout'];

/** Charges, payments and balance for a booking. Revenue = verified payments only. */
export function amountsFor(db: DB, b: Booking, overrideGuests?: number) {
  const lines: { label: string; amount: number }[] = [];
  if (b.source === 'airbnb') {
    lines.push({ label: 'Airbnb stay (payout)', amount: b.airbnb_payout ?? 0 });
  } else {
    const p = overrideGuests && overrideGuests !== b.declared_guests ? calculatePrice(db.settings, overrideGuests, b.nights) : b.price_breakdown;
    if (p) {
      lines.push({ label: `Nightly rate ${p.counted_guests} guests (₱${p.nightly_rate.toLocaleString()} × ${p.nights})`, amount: p.room_subtotal });
      lines.push({ label: 'Cleaning fee', amount: p.cleaning_fee });
    }
  }
  for (const c of b.extra_charges) lines.push(c);
  const charges = lines.reduce((s, l) => s + l.amount, 0);
  const pays = db.payments.filter((p) => p.booking_id === b.id);
  const verified = pays.filter((p) => p.status === 'verified');
  const paid = verified.filter((p) => BILL_TYPES.includes(p.type)).reduce((s, p) => s + p.amount, 0) - verified.filter((p) => p.type === 'refund').reduce((s, p) => s + p.amount, 0);
  const pending = pays.filter((p) => p.status === 'submitted').reduce((s, p) => s + p.amount, 0);
  const depositHeld = verified.filter((p) => p.type === 'deposit').reduce((s, p) => s + p.amount, 0) - verified.filter((p) => p.type === 'deposit_refund').reduce((s, p) => s + p.amount, 0);
  return { lines, charges, paid, pending, balance: Math.max(0, charges - paid), depositHeld };
}

/** Revenue in a period = sum of verified, revenue-bearing payments (minus refunds). */
export function revenue(db: DB, from: string, toExclusive: string) {
  let direct = 0, airbnb = 0, penalties = 0;
  for (const p of db.payments) {
    if (p.status !== 'verified') continue;
    const d = manilaToday(new Date(p.verified_at ?? p.created_at));
    if (d < from || d >= toExclusive) continue;
    const sign = p.type === 'refund' ? -1 : BILL_TYPES.includes(p.type) ? 1 : 0;
    if (!sign) continue;
    const b = db.bookings.find((x) => x.id === p.booking_id);
    if (b?.source === 'airbnb') airbnb += sign * p.amount; else direct += sign * p.amount;
    if (p.type === 'penalty') penalties += p.amount;
  }
  return { direct, airbnb, total: direct + airbnb, penalties };
}
