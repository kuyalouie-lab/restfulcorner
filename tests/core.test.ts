import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { allotment, calculatePrice, undeclaredCharge } from '@/lib/pricing';
import { emptyDB, seedDB } from '@/lib/seed';
import { addDays, manilaToday } from '@/lib/dates';
import * as E from '@/lib/engine';
import { createMutex } from '@/lib/lock';
import { buildIcal, parseIcal } from '@/lib/ical';
import { amountsFor, revenue } from '@/lib/money';
import type { DB } from '@/lib/types';

const s = DEFAULT_SETTINGS;
const now = new Date('2026-11-09T10:00:00+08:00');
const ctx = (n = now) => ({ now: n, actor: 'test', baseUrl: 'https://x' });

function input(over: Partial<E.BookingInput> = {}): E.BookingInput {
  const g = over.declared_guests ?? 3;
  return {
    check_in_date: '2026-11-20', check_out_date: '2026-11-21', declared_guests: g, infants: 0, aircon_choice: 'sala',
    booker_name: 'Maria Santos', booker_mobile: '09171234567', booker_email: 'maria@example.com',
    guest_names: Array.from({ length: g }, (_, i) => `Guest Number${i}`), id_file: { name: 'id.jpg', dataUrl: 'data:x' },
    special_requests: 'none', language: 'en', agree_rules: true, agree_penalty: true, agree_expectations: true, agree_privacy: true, ...over,
  };
}

describe('pricing', () => {
  it.each([
    [1, 2900, 3100], [2, 2900, 3100], [3, 3400, 3600], [4, 3900, 4100], [7, 5400, 5600],
  ])('%i guests → nightly %i, 1-night total %i', (g, nightly, total) => {
    const p = calculatePrice(s, g, 1);
    expect(p.nightly_rate).toBe(nightly);
    expect(p.total).toBe(total);
    expect(p.downpayment).toBe(1000);
    expect(p.balance_at_checkin).toBe(total - 1000);
  });
  it('multi-night: cleaning fee once', () => {
    expect(calculatePrice(s, 4, 3).total).toBe(3900 * 3 + 200);
  });
  it('infants excluded: price depends only on counted guests', () => {
    const db = emptyDB();
    const b = E.createBooking(db, ctx(), input({ declared_guests: 2, infants: 2 }));
    expect(b.price_breakdown!.total).toBe(3100);
    expect(b.rooms_allowed).toBe(1);
  });
  it('rejects above max_guests', () => {
    expect(() => calculatePrice(s, 8, 1)).toThrow();
    expect(() => calculatePrice({ ...s, max_guests: 5 }, 6, 1)).toThrow();
  });
  it('allotment: 1–3 one room + chosen aircon, 4+ both', () => {
    expect(allotment(3, 'bedroom')).toEqual({ rooms: 1, aircon: 'bedroom' });
    expect(allotment(4, 'sala')).toEqual({ rooms: 2, aircon: 'both' });
  });
  it('undeclared: declared 3, actual 6 → 3 × ₱2,500', () => {
    expect(undeclaredCharge(s, 3, 6)).toMatchObject({ undeclared: 3, total: 7500 });
  });
});

describe('booking rules', () => {
  it('requires aircon choice for 1–3, matching name count, ID, agreements; stores timestamp + IP', () => {
    const db = emptyDB();
    expect(() => E.createBooking(db, ctx(), input({ aircon_choice: null }))).toThrow(/aircon_required/);
    expect(() => E.createBooking(db, ctx(), input({ guest_names: ['Only One'] }))).toThrow(/guest_names/);
    expect(() => E.createBooking(db, ctx(), input({ id_file: null }))).toThrow(/id_required/);
    expect(() => E.createBooking(db, ctx(), input({ agree_penalty: false }))).toThrow(/agreements/);
    const b = E.createBooking(db, ctx(), input({ ip: '1.2.3.4' }));
    expect(b.rules_accepted_at).toBe(now.toISOString());
    expect(b.rules_accepted_ip).toBe('1.2.3.4');
    expect(b.booker_mobile).toBe('+639171234567');
  });

  it('two simultaneous bookings for the same night: only one succeeds', async () => {
    const db = emptyDB();
    const lock = createMutex();
    const attempt = (name: string) => lock(async () => {
      await new Promise((r) => setTimeout(r, 5)); // simulate upload latency inside critical section
      return E.createBooking(db, ctx(), input({ booker_name: name }));
    });
    const res = await Promise.allSettled([attempt('Ana Cruz'), attempt('Jose Reyes')]);
    expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(res.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(db.bookings).toHaveLength(1);
  });

  it('hold expires after hold_hours and dates become available', () => {
    const db = emptyDB();
    E.createBooking(db, ctx(), input());
    expect(E.isRangeFree(db, '2026-11-20', '2026-11-21')).toBe(false);
    E.expireHolds(db, ctx(new Date(now.getTime() + 2.9 * 3600_000)));
    expect(db.bookings[0].status).toBe('pending_payment');
    E.expireHolds(db, ctx(new Date(now.getTime() + 3 * 3600_000 + 1)));
    expect(db.bookings[0].status).toBe('expired');
    expect(E.isRangeFree(db, '2026-11-20', '2026-11-21')).toBe(true);
  });

  it('back-to-back stays allowed (check-out day = next check-in day)', () => {
    const db = emptyDB();
    E.createBooking(db, ctx(), input());
    expect(() => E.createBooking(db, ctx(), input({ check_in_date: '2026-11-21', check_out_date: '2026-11-22' }))).not.toThrow();
  });

  it('full flow: pay → verify → approve → check-in with 6 for declared 3', () => {
    const db: DB = emptyDB();
    const b = E.createBooking(db, ctx(), input());
    E.submitPaymentProof(db, ctx(), b.code, b.guest_token, '1234567890123', 'data:proof');
    expect(b.status).toBe('payment_submitted');
    expect(db.message_log.some((m) => m.template === 'owner_payment' && m.channel === 'sms')).toBe(true);
    expect(() => E.approveBooking(db, ctx(), b.id)).toThrow(/verify_payment_first/);
    E.verifyPayment(db, ctx(), db.payments[0].id);
    E.approveBooking(db, ctx(), b.id);
    expect(b.status).toBe('confirmed');
    expect(db.invoices[0].number).toBe('TRC-INV-2026-0001');
    expect(amountsFor(db, b).balance).toBe(2600);
    const r = E.setHeadcount(db, ctx(), b.id, 6, 0);
    expect(r).toMatchObject({ undeclared: 3, amount: 7500 });
    expect(amountsFor(db, b).balance).toBe(2600 + 7500);
    expect(db.message_log.some((m) => m.template === 'owner_undeclared' && m.channel === 'sms')).toBe(true);
    // re-entering same headcount doesn't double-charge
    E.setHeadcount(db, ctx(), b.id, 6, 0);
    expect(amountsFor(db, b).balance).toBe(10100);
    E.checkIn(db, ctx(), b.id, {}, '');
    expect(b.status).toBe('checked_in');
  });

  it('wrong token is rejected', () => {
    const db = emptyDB();
    const b = E.createBooking(db, ctx(), input());
    expect(E.findByToken(db, b.code, 'nope')).toBeNull();
    expect(() => E.submitPaymentProof(db, ctx(), b.code, 'nope', '1', 'x')).toThrow(/invalid_link/);
  });
});

describe('airbnb ical', () => {
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261125\r\nDTEND;VALUE=DATE:20261127\r\nUID:abc@airbnb.com\r\nSUMMARY:Reserved\r\nEND:VEVENT\r\nEND:VCALENDAR';
  it('import blocks nights in one sync, removal unblocks', () => {
    const db = emptyDB();
    E.importAirbnbIcal(db, ctx(), ics);
    expect(E.isRangeFree(db, '2026-11-25', '2026-11-26')).toBe(false);
    expect(E.isRangeFree(db, '2026-11-27', '2026-11-28')).toBe(true);
    E.importAirbnbIcal(db, ctx(), 'BEGIN:VCALENDAR\r\nEND:VCALENDAR');
    expect(E.isRangeFree(db, '2026-11-25', '2026-11-26')).toBe(true);
  });
  it('export includes direct bookings and is parseable', () => {
    const db = emptyDB();
    E.createBooking(db, ctx(), input());
    const out = buildIcal(db, now);
    expect(out).toMatch(/BEGIN:VCALENDAR/);
    expect(parseIcal(out)).toEqual([expect.objectContaining({ start: '2026-11-20', end: '2026-11-21' })]);
  });
});

describe('dashboard', () => {
  it('revenue equals the sum of verified payments in the period', () => {
    const db = seedDB(now);
    const from = manilaToday(now).slice(0, 8) + '01', to = addDays(from, 40).slice(0, 8) + '01';
    const expected = db.payments
      .filter((p) => p.status === 'verified' && ['downpayment', 'balance', 'penalty', 'extra_guest', 'airbnb_payout'].includes(p.type))
      .filter((p) => { const d = manilaToday(new Date(p.verified_at!)); return d >= from && d < to; })
      .reduce((a, p) => a + p.amount, 0);
    expect(revenue(db, from, to).total).toBe(expected);
  });
  it('seed data has no double-booked nights', () => {
    const db = seedDB(now);
    const taken = new Map<string, string>();
    for (const b of db.bookings.filter((x) => E.ACTIVE.includes(x.status))) {
      for (let d = b.check_in_date; d < b.check_out_date; d = addDays(d, 1)) {
        expect(taken.has(d), `${d} ${b.code} vs ${taken.get(d)}`).toBe(false);
        taken.set(d, b.code);
      }
    }
  });
});
