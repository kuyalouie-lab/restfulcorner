'use client';
import Link from 'next/link';
import { AppShell } from './shell';
import { Allotment, Card, Loading, SourceBadge, StatusBadge } from './ui';
import { useStore } from '@/lib/store';
import { addDays, fmtDate, manilaToday, peso } from '@/lib/dates';
import { amountsFor } from '@/lib/money';
import type { Booking, DB } from '@/lib/types';

function StayCard({ db, b, kind }: { db: DB; b: Booking; kind: 'in' | 'out' | 'stay' }) {
  const a = amountsFor(db, b);
  return <Link href={`/staff/booking/?id=${b.id}`} className="block">
    <div className="rounded-2xl border bg-white p-4 shadow-sm active:bg-stone-50">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div><div className="text-lg font-bold">{b.booker_name}</div><div className="text-xs text-stone-500">{b.code} · {fmtDate(b.check_in_date)} → {fmtDate(b.check_out_date)}</div></div>
        <div className="flex flex-col items-end gap-1"><StatusBadge s={b.status} /><SourceBadge s={b.source} /></div>
      </div>
      <div className="mb-2 text-sm">Declared: <b className="text-lg">{b.declared_guests}</b> guests{b.infants ? <> + <b>{b.infants}</b> infant(s)</> : null}{b.undeclared_guests > 0 && <span className="ml-2 font-bold text-red-600">+{b.undeclared_guests} undeclared</span>}</div>
      <Allotment b={b} s={db.settings} big />
      <div className="mt-2 flex justify-between text-sm"><span>{kind === 'in' ? 'Check-in 2:00 PM' : kind === 'out' ? 'Check-out 12:00 NN' : 'Staying'}</span><span>Balance due: <b className={a.balance > 0 ? 'text-red-600' : 'text-emerald-700'}>{peso(a.balance)}</b></span></div>
    </div>
  </Link>;
}

export function StaffList({ mode }: { mode: 'today' | 'upcoming' }) {
  const { db } = useStore();
  if (!db) return <AppShell role="staff"><Loading /></AppShell>;
  const today = manilaToday(), tomorrow = addDays(today, 1);
  const live = db.bookings.filter((b) => ['confirmed', 'checked_in', 'checked_out'].includes(b.status));
  const section = (title: string, list: Booking[], kind: 'in' | 'out' | 'stay') => <section className="space-y-2">
    <h2 className="text-sm font-bold uppercase text-stone-500">{title} ({list.length})</h2>
    {list.length ? list.map((b) => <StayCard key={b.id + kind} db={db} b={b} kind={kind} />) : <Card><p className="text-sm text-stone-500">None</p></Card>}
  </section>;
  return <AppShell role="staff">
    {mode === 'today' ? <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-xl font-bold">Today · {fmtDate(today)}</h1>
      {section('Check-ins today', live.filter((b) => b.check_in_date === today && b.status !== 'checked_out'), 'in')}
      {section('Check-outs today', live.filter((b) => b.check_out_date === today), 'out')}
      {section('In-house now', live.filter((b) => b.status === 'checked_in' && b.check_in_date < today && b.check_out_date > today), 'stay')}
      {section('Tomorrow’s check-ins', live.filter((b) => b.check_in_date === tomorrow), 'in')}
      {section('Tomorrow’s check-outs', live.filter((b) => b.check_out_date === tomorrow), 'out')}
    </div> : <div className="mx-auto max-w-xl space-y-3">
      <h1 className="text-xl font-bold">Upcoming (next 30 days)</h1>
      {live.filter((b) => b.check_in_date > tomorrow && b.check_in_date <= addDays(today, 30) && b.status === 'confirmed').sort((a, b) => a.check_in_date.localeCompare(b.check_in_date)).map((b) => <StayCard key={b.id} db={db} b={b} kind="in" />)}
    </div>}
  </AppShell>;
}
