'use client';
import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/shell';
import { RevenueChart } from '@/components/revenue-chart';
import { Allotment, Btn, Card, Loading, SourceBadge, StatusBadge } from '@/components/ui';
import { useStore } from '@/lib/store';
import { addDays, fmtDate, fmtDateTime, manilaToday, peso } from '@/lib/dates';
import { ACTIVE } from '@/lib/engine';
import { amountsFor, revenue } from '@/lib/money';

const REPLY = {
  en: `Hi! Thanks for your interest in The Restful Corner 😊 You can check available dates, rates, and book here: {LINK}\nRates start at ₱2,900/night for 1–2 guests (+₱500 per extra guest). A ₱1,000 GCash downpayment holds your dates. Please declare all guests (2 yrs+) — every guest registers at the lobby with a valid ID.`,
  fil: `Hi po! Salamat sa interes sa The Restful Corner 😊 Makikita po ang bakanteng petsa, presyo, at puwede nang mag-book dito: {LINK}\nMula ₱2,900/gabi para sa 1–2 bisita (+₱500 bawat dagdag). ₱1,000 GCash downpayment para ma-reserve. Pakideklara po lahat ng bisita (2 taon pataas) — magpaparehistro lahat sa lobby gamit ang valid ID.`,
};

export default function Dashboard() {
  const { db, act } = useStore();
  const [copied, setCopied] = useState('');
  if (!db) return <AppShell role="admin"><Loading /></AppShell>;
  const today = manilaToday();
  const month = today.slice(0, 7);
  const monthStart = month + '-01';
  const [yy, mm] = month.split('-').map(Number);
  const nextMonth = new Date(Date.UTC(yy, mm, 1)).toISOString().slice(0, 10);
  const daysInMonth = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const rev = revenue(db, monthStart, nextMonth);
  const byId = (id: string) => db.bookings.find((b) => b.id === id)!;

  // action queue
  const toVerify = db.payments.filter((p) => p.status === 'submitted');
  const toApprove = db.bookings.filter((b) => b.status === 'payment_submitted' && db.payments.some((p) => p.booking_id === b.id && p.type === 'downpayment' && p.status === 'verified'));
  const changes = db.bookings.filter((b) => b.pending_change);
  const refunds = db.bookings.filter((b) => b.status === 'refund_due');
  const cancels = db.bookings.filter((b) => b.cancel_requested_at && ['pending_payment', 'payment_submitted', 'confirmed'].includes(b.status));
  const expiring = db.bookings.filter((b) => b.status === 'pending_payment' && b.hold_expires_at && new Date(b.hold_expires_at).getTime() - Date.now() < 3600_000 * 3);
  const failed = db.message_log.filter((m) => m.status === 'failed').slice(0, 5);

  // month metrics
  const stayed = new Set<string>();
  let bookedNights = 0;
  for (let i = 0; i < daysInMonth; i++) {
    const d = addDays(monthStart, i);
    const b = db.bookings.find((x) => [...ACTIVE, 'checked_out'].includes(x.status) && x.check_in_date <= d && d < x.check_out_date);
    const k = db.calendar_blocks.find((x) => x.source === 'airbnb_ical' && !x.converted_booking_id && x.start_date <= d && d < x.end_date);
    if (b) stayed.add(b.id);
    if (b || k) bookedNights++;
  }
  const bookingsThisMonth = db.bookings.filter((b) => b.check_in_date.startsWith(month) && [...ACTIVE, 'checked_out'].includes(b.status)).length;

  const chart = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(yy, mm - 12 + i, 1));
    const from = d.toISOString().slice(0, 10), to = new Date(Date.UTC(yy, mm - 11 + i, 1)).toISOString().slice(0, 10);
    const r = revenue(db, from, to);
    return { month: from.slice(0, 7), direct: r.direct, airbnb: r.airbnb };
  });
  const upcoming = db.bookings.filter((b) => ['confirmed', 'checked_in', 'payment_submitted'].includes(b.status) && b.check_out_date > today && b.check_in_date <= addDays(today, 14)).sort((a, b) => a.check_in_date.localeCompare(b.check_in_date));
  const link = typeof window !== 'undefined' ? `${window.location.origin}/book/` : '/book/';

  const Q = ({ title, items, color }: { title: string; items: { id: string; label: React.ReactNode; href: string }[]; color: string }) => items.length ? <div>
    <div className={`mb-1 text-xs font-bold uppercase ${color}`}>{title} ({items.length})</div>
    <ul className="space-y-1">{items.map((i) => <li key={i.id}><Link href={i.href} className="block rounded-lg border bg-white px-3 py-2 text-sm hover:border-brand-500">{i.label}</Link></li>)}</ul>
  </div> : null;
  const queueEmpty = !toVerify.length && !toApprove.length && !changes.length && !refunds.length && !cancels.length && !expiring.length;

  return <AppShell role="admin">
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Action queue" className="lg:col-span-1">
        <div className="space-y-4">
          {queueEmpty && <p className="text-sm text-stone-500">All caught up 🎉</p>}
          <Q title="Payments to verify" color="text-sky-700" items={toVerify.map((p) => { const b = byId(p.booking_id); return { id: p.id, href: `/admin/booking/?id=${b.id}`, label: <>{b.code} · {b.booker_name} · {peso(p.amount)} <span className="text-stone-400">ref {p.reference_no}</span></> }; })} />
          <Q title="Awaiting approval" color="text-emerald-700" items={toApprove.map((b) => ({ id: b.id, href: `/admin/booking/?id=${b.id}`, label: <>{b.code} · {b.booker_name} · {b.check_in_date} · {b.declared_guests} guests</> }))} />
          <Q title="Guest-add requests" color="text-amber-700" items={changes.map((b) => ({ id: b.id, href: `/admin/booking/?id=${b.id}`, label: <>{b.code} · {b.declared_guests} → {b.pending_change!.declared_guests} guests</> }))} />
          <Q title="Cancellation requests" color="text-orange-700" items={cancels.map((b) => ({ id: b.id, href: `/admin/booking/?id=${b.id}`, label: <>{b.code} · {b.booker_name} · {b.check_in_date}</> }))} />
          <Q title="Refunds due" color="text-rose-700" items={refunds.map((b) => ({ id: b.id, href: `/admin/booking/?id=${b.id}`, label: <>{b.code} · {b.booker_name} · {peso(amountsFor(db, b).paid)}</> }))} />
          <Q title="Holds expiring soon" color="text-stone-600" items={expiring.map((b) => ({ id: b.id, href: `/admin/booking/?id=${b.id}`, label: <>{b.code} · expires {fmtDateTime(b.hold_expires_at!)}</> }))} />
          {failed.length > 0 && <div>
            <div className="mb-1 text-xs font-bold uppercase text-red-700">Failed messages</div>
            <ul className="space-y-1">{failed.map((m) => <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs"><span>{m.channel.toUpperCase()} {m.template} → {m.to}<br /><span className="text-red-700">{m.error}</span></span>
              <Btn variant="outline" className="!min-h-[32px] text-xs" onClick={() => act((d, c) => { const x = d.message_log.find((y) => y.id === m.id)!; x.status = 'sent'; x.error = null; x.sent_at = c.now.toISOString(); x.template += ' (resent)'; })}>Resend</Btn></li>)}</ul>
          </div>}
        </div>
      </Card>

      <div className="space-y-4 lg:col-span-2">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Revenue this month" value={peso(rev.total)} sub={`Direct ${peso(rev.direct)} · Airbnb ${peso(rev.airbnb)}`} />
          <Stat label="Bookings (check-ins)" value={String(bookingsThisMonth)} sub={new Date(monthStart + 'T00:00:00Z').toLocaleDateString('en-PH', { month: 'long', timeZone: 'UTC' })} />
          <Stat label="Occupancy" value={`${Math.round((bookedNights / daysInMonth) * 100)}%`} sub={`${bookedNights}/${daysInMonth} nights`} />
          <Stat label="Penalties collected" value={peso(rev.penalties)} sub="undeclared guests" />
        </div>
        <Card title="Revenue per month (verified payments)"><RevenueChart data={chart} /></Card>
        <Card title="Next 14 days">
          {!upcoming.length ? <p className="text-sm text-stone-500">No stays.</p> : <ul className="divide-y">{upcoming.map((b) => <li key={b.id}><Link href={`/admin/booking/?id=${b.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div><div className="font-medium">{fmtDate(b.check_in_date)} · {b.nights}n · {b.booker_name}</div><div className="flex gap-1 text-xs"><SourceBadge s={b.source} /><StatusBadge s={b.status} /><span className="text-stone-500">{b.declared_guests} guests{b.infants ? ` + ${b.infants} infant` : ''}</span></div></div>
            <div className="w-56"><Allotment b={b} s={db.settings} /></div>
          </Link></li>)}</ul>}
        </Card>
        <Card title="Messenger reply template (copy & paste)">
          <div className="grid gap-3 md:grid-cols-2">{(['en', 'fil'] as const).map((l) => { const txt = REPLY[l].replace('{LINK}', link); return <div key={l}><pre className="whitespace-pre-wrap rounded-lg bg-stone-50 p-3 text-xs">{txt}</pre><Btn variant="outline" className="mt-1 !min-h-[32px] text-xs" onClick={() => { navigator.clipboard?.writeText(txt); setCopied(l); }}>{copied === l ? 'Copied ✓' : `Copy ${l.toUpperCase()}`}</Btn></div>; })}</div>
        </Card>
      </div>
    </div>
  </AppShell>;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="rounded-2xl border bg-white p-3"><div className="text-xs text-stone-500">{label}</div><div className="text-2xl font-bold tabular-nums">{value}</div>{sub && <div className="text-xs text-stone-500">{sub}</div>}</div>;
}
