'use client';
import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/shell';
import { Card, Loading, SourceBadge, StatusBadge, inputCls } from '@/components/ui';
import { useStore } from '@/lib/store';
import { peso } from '@/lib/dates';
import { amountsFor } from '@/lib/money';
import type { BookingStatus } from '@/lib/types';

const STATUSES: BookingStatus[] = ['pending_payment', 'payment_submitted', 'confirmed', 'checked_in', 'checked_out', 'expired', 'declined', 'cancelled', 'refund_due'];

export default function Bookings() {
  const { db } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  if (!db) return <AppShell role="admin"><Loading /></AppShell>;
  const rows = db.bookings
    .filter((b) => (!status || b.status === status) && (!source || b.source === source) && (!from || b.check_in_date >= from) && (!to || b.check_in_date <= to))
    .filter((b) => !q || `${b.code} ${b.booker_name} ${b.booker_mobile} ${b.booker_email}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.check_in_date.localeCompare(a.check_in_date));
  return <AppShell role="admin">
    <Card title={`Bookings (${rows.length})`}>
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        <input className={inputCls + ' col-span-2 md:col-span-1'} placeholder="Search name / code / mobile" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select>
        <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value)}><option value="">All sources</option><option value="direct">Facebook / Direct</option><option value="airbnb">Airbnb</option><option value="manual">Manual</option></select>
        <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Check-in from" />
        <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} aria-label="Check-in to" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="border-b text-left text-xs text-stone-500"><th className="py-2">Code</th><th>Guest</th><th>Dates</th><th>Guests</th><th>Source</th><th>Status</th><th className="text-right">Total</th><th className="text-right">Balance</th></tr></thead>
          <tbody>{rows.map((b) => { const a = amountsFor(db, b); return <tr key={b.id} className="border-b hover:bg-stone-50">
            <td className="py-2"><Link className="font-mono text-brand-700 underline" href={`/admin/booking/?id=${b.id}`}>{b.code}</Link></td>
            <td>{b.booker_name}{b.pending_change && <span className="ml-1 text-amber-600" title="Guest change pending">●</span>}</td>
            <td className="whitespace-nowrap">{b.check_in_date} · {b.nights}n</td>
            <td>{b.declared_guests}{b.infants ? `+${b.infants}` : ''}{b.undeclared_guests ? <span className="ml-1 text-red-600">(+{b.undeclared_guests}!)</span> : ''}</td>
            <td><SourceBadge s={b.source} /></td><td><StatusBadge s={b.status} /></td>
            <td className="text-right tabular-nums">{peso(a.charges)}</td><td className="text-right tabular-nums">{peso(a.balance)}</td>
          </tr>; })}</tbody>
        </table>
      </div>
    </Card>
  </AppShell>;
}
