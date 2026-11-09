'use client';
import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/shell';
import { Btn, Card, Field, Loading, MonthGrid, cx, inputCls, thisMonth } from '@/components/ui';
import { useStore } from '@/lib/store';
import { addDays, manilaToday } from '@/lib/dates';
import { ACTIVE, addBlock, removeBlock } from '@/lib/engine';
import type { Booking, CalendarBlock } from '@/lib/types';

const colorFor = (b: Booking) => b.status === 'checked_out' ? 'bg-stone-300 text-stone-700' : b.status === 'pending_payment' ? 'bg-amber-200 text-amber-900' : b.status === 'payment_submitted' ? 'bg-sky-200 text-sky-900' : b.source === 'airbnb' ? 'bg-rose-500 text-white' : 'bg-blue-600 text-white';

export default function AdminCalendar() {
  const { db, act } = useStore();
  const [month, setMonth] = useState(thisMonth());
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState<'maintenance' | 'personal'>('maintenance');
  const [err, setErr] = useState('');
  if (!db) return <AppShell role="admin"><Loading /></AppShell>;
  const today = manilaToday();
  const at = (d: string): { b?: Booking; k?: CalendarBlock } => {
    const b = db.bookings.find((x) => [...ACTIVE, 'checked_out'].includes(x.status) && x.check_in_date <= d && d < x.check_out_date);
    if (b) return { b };
    const k = db.calendar_blocks.find((x) => !x.converted_booking_id && x.start_date <= d && d < x.end_date);
    return { k };
  };
  return <AppShell role="admin">
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2" title="Calendar (by night)">
        <MonthGrid month={month} onMonth={setMonth} render={(d) => {
          const { b, k } = at(d);
          const inner = <div className={cx('flex aspect-square w-full flex-col justify-between overflow-hidden rounded-lg p-1 text-left text-[10px] leading-tight sm:text-xs', b ? colorFor(b) : k ? (k.source === 'airbnb_ical' ? 'bg-rose-100 text-rose-800 [background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(225,29,72,.15)_4px,rgba(225,29,72,.15)_8px)]' : 'bg-stone-700 text-white') : 'bg-white border', d === today && 'ring-2 ring-brand-500')}>
            <span className="font-semibold">{Number(d.slice(8))}</span>
            <span className="truncate">{b ? (b.check_in_date === d ? b.booker_name.split(' ')[0] : '·') : k ? (k.source === 'airbnb_ical' ? 'Airbnb' : k.reason) : ''}</span>
          </div>;
          return b ? <Link href={`/admin/booking/?id=${b.id}`}>{inner}</Link> : k?.source === 'airbnb_ical' ? <Link href="/admin/airbnb/">{inner}</Link> : inner;
        }} />
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          {[['bg-blue-600', 'Direct confirmed'], ['bg-rose-500', 'Airbnb booking'], ['bg-rose-100', 'Airbnb block (unconverted)'], ['bg-sky-200', 'Payment submitted'], ['bg-amber-200', 'Awaiting payment'], ['bg-stone-300', 'Checked out'], ['bg-stone-700', 'Manual block']].map(([c, l]) => <span key={l} className="flex items-center gap-1"><i className={`h-3 w-3 rounded ${c}`} />{l}</span>)}
        </div>
      </Card>
      <div className="space-y-4">
        <Card title="Add a block">
          <div className="space-y-2">
            <Field label="From (first night)"><input type="date" className={inputCls} value={start} onChange={(e) => { setStart(e.target.value); if (!end || end <= e.target.value) setEnd(addDays(e.target.value, 1)); }} /></Field>
            <Field label="Until (check-out day)"><input type="date" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
            <Field label="Reason"><select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value as 'maintenance')}><option value="maintenance">Maintenance</option><option value="personal">Personal use</option></select></Field>
            {err && <p className="text-sm text-red-600">{err.replace(/_/g, ' ')}</p>}
            <Btn className="w-full" disabled={!start || !end} onClick={() => { setErr(''); try { act((d, c) => addBlock(d, c, start, end, reason)); setStart(''); setEnd(''); } catch (e) { setErr((e as Error).message); } }}>Block dates</Btn>
          </div>
        </Card>
        <Card title="Manual blocks">
          <ul className="divide-y text-sm">{db.calendar_blocks.filter((k) => k.source === 'manual').map((k) => <li key={k.id} className="flex items-center justify-between py-2"><span>{k.start_date} → {k.end_date} · {k.reason}</span><Btn variant="ghost" className="!min-h-[32px] text-red-600" onClick={() => act((d, c) => removeBlock(d, c, k.id))}>Remove</Btn></li>)}</ul>
        </Card>
      </div>
    </div>
  </AppShell>;
}
