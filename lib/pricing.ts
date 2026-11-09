import type { Aircon, PriceBreakdown, Settings } from './types';

export class PricingError extends Error {}

/**
 * nightly_rate = base_rate + extra_guest_fee × max(0, counted − base_guests)
 * total        = nightly_rate × nights + cleaning_fee (once per stay)
 * Infants (<2) are NOT passed here — they never affect price.
 */
export function calculatePrice(s: Settings, countedGuests: number, nights: number): PriceBreakdown {
  if (!Number.isInteger(countedGuests) || countedGuests < 1) throw new PricingError('At least 1 counted guest is required');
  if (countedGuests > s.max_guests) throw new PricingError(`Maximum is ${s.max_guests} guests`);
  if (!Number.isInteger(nights) || nights < 1) throw new PricingError('At least 1 night is required');
  const extra_guests = Math.max(0, countedGuests - s.base_guests);
  const nightly_rate = s.base_rate + s.extra_guest_fee * extra_guests;
  const room_subtotal = nightly_rate * nights;
  const total = room_subtotal + s.cleaning_fee;
  const downpayment = Math.min(s.downpayment_amount, total);
  return { nights, counted_guests: countedGuests, nightly_rate, extra_guests, room_subtotal, cleaning_fee: s.cleaning_fee, total, downpayment, balance_at_checkin: total - downpayment };
}

/** 1–3 counted guests → 1 room + 1 aircon (guest's choice). 4+ → both rooms, both aircons. */
export function allotment(countedGuests: number, choice?: Aircon | null): { rooms: 1 | 2; aircon: Aircon } {
  if (countedGuests >= 4) return { rooms: 2, aircon: 'both' };
  return { rooms: 1, aircon: choice === 'bedroom' ? 'bedroom' : 'sala' };
}

export function poolLimit(s: Settings, rooms: 1 | 2) {
  return s.pool_limit_per_room * rooms;
}

/** Each undeclared guest = penalty + extra guest fee (₱2,000 + ₱500 = ₱2,500 by default). */
export function undeclaredCharge(s: Settings, declared: number, actual: number) {
  const undeclared = Math.max(0, actual - declared);
  const per = s.undeclared_penalty + s.extra_guest_fee;
  return { undeclared, per, penalty: undeclared * s.undeclared_penalty, extraFees: undeclared * s.extra_guest_fee, total: undeclared * per };
}
