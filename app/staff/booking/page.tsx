'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shell';
import { Allotment, Btn, Card, Field, Loading, StatusBadge, cx, inputCls, useQuery } from '@/components/ui';
import { fileToStored, useStore } from '@/lib/store';
import { fmtDate, peso } from '@/lib/dates';
import * as E from '@/lib/engine';
import { amountsFor } from '@/lib/money';
import { undeclaredCharge } from '@/lib/pricing';
import type { PaymentType } from '@/lib/types';

/** Staff check-in / check-out. Staff never see ID images or sales totals. */
export default function StaffBooking() {
  const { db, act } = useStore();
  const id = useQuery('id');
  const [actual, setActual] = useState<number | null>(null);
  const [inf, setInf] = useState(0);
  const [pay, setPay] = useState<{ type: PaymentType; method: 'gcash' | 'cash'; amount: number; ref: string; proof: string | null }>({ type: 'balance', method: 'cash', amount: 0, ref: '', proof: null });
  const [check, setCheck] = useState<Record<string, boolean>>({});
  const [outCheck, setOutCheck] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [extra, setExtra] = useState({ label: '', amount: 0 });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const b = db?.bookings.find((x) => x.id === id);
  useEffect(() => { if (b && actual === null) { setActual(b.actual_guests ?? b.declared_guests); setInf(b.infants); } }, [b, actual]);
  if (!db || id === undefined || actual === null) return <AppShell role="staff"><Loading /></AppShell>;
  if (!b) return <AppShell role="staff"><Card>Not found.</Card></AppShell>;
  const s = db.settings;
  const a = amountsFor(db, b);
  const u = undeclaredCharge(s, b.declared_guests, actual);
  const newUndeclared = Math.max(0, u.undeclared - b.undeclared_guests);
  const run = (fn: Parameters<typeof act>[0], ok: string) => { setErr(''); try { act(fn); setMsg(ok); window.scrollTo({ top: 0 }); } catch (e) { setErr((e as Error).message.replace(/_/g, ' ')); } };
  const items = s.checkin_checklist.filter((c) => b.rooms_allowed === 1 || !/2nd room/i.test(c));

  return <AppShell role="staff">
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between"><Link href="/staff/" className="text-sm text-stone-500">← Today</Link><StatusBadge s={b.status} /></div>
      {msg && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{msg}</p>}
      {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      <Card>
        <div className="text-2xl font-bold">{b.booker_name}</div>
        <div className="text-sm text-stone-500">{b.code} · {fmtDate(b.check_in_date)} → {fmtDate(b.check_out_date)} · <a className="underline" href={`tel:${b.booker_mobile}`}>{b.booker_mobile}</a></div>
        <div className="my-3"><Allotment b={b} s={s} big /></div>
        <div className="text-sm">Declared <b className="text-lg">{b.declared_guests}</b> counted{b.infants ? ` + ${b.infants} infant(s)` : ''}</div>
        <Link href={`/guest-list/?id=${b.id}`} className="mt-2 inline-flex min-h-[44px] items-center rounded-xl border px-4 text-sm font-semibold">🖨 Guest list for the lobby guard</Link>
        <ol className="mt-2 list-decimal pl-5 text-sm">{b.guests.map((g) => <li key={g.id}>{g.full_name}{g.age_group === 'infant' ? ' 👶' : ''}</li>)}</ol>
      </Card>

      {['confirmed', 'checked_in'].includes(b.status) && <Card title={b.status === 'confirmed' ? '1–2. Confirm ID in person & count heads' : 'Headcount (late-found undeclared guests)'}>
        {b.status === 'confirmed' && <p className="mb-3 text-sm">Check the booker’s valid ID matches <b>{b.booker_name}</b>.</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Actual guests (2 yrs+)"><div className="flex items-center gap-2"><Btn variant="outline" className="w-12 text-xl" onClick={() => setActual(Math.max(1, actual - 1))}>−</Btn><span className="w-8 text-center text-3xl font-bold">{actual}</span><Btn variant="outline" className="w-12 text-xl" onClick={() => setActual(actual + 1)}>+</Btn></div></Field>
          <Field label="Infants (<2)"><input type="number" min={0} className={inputCls} value={inf} onChange={(e) => setInf(Number(e.target.value))} /></Field>
        </div>
        {u.undeclared > 0 && <div className="mt-3 rounded-xl border-2 border-red-500 bg-red-50 p-3 text-red-800">
          <div className="text-lg font-extrabold">{u.undeclared} UNDECLARED GUEST{u.undeclared > 1 ? 'S' : ''}</div>
          <div className="text-sm">{u.undeclared} × {peso(u.per)} (₱{s.undeclared_penalty.toLocaleString()} penalty + ₱{s.extra_guest_fee.toLocaleString()} fee) = <b>{peso(u.total)}</b></div>
          {newUndeclared > 0 && <div className="text-xs">Saving adds {peso(newUndeclared * u.per)} to the amount due and texts the owner.</div>}
        </div>}
        <Btn className="mt-3 w-full" onClick={() => run((d, c) => { const r = E.setHeadcount(d, c, b.id, actual, inf); return r; }, newUndeclared > 0 ? `Saved. ${peso(newUndeclared * u.per)} added; owner notified by SMS.` : 'Headcount saved.')}>Save headcount</Btn>
      </Card>}

      {['confirmed', 'checked_in', 'checked_out'].includes(b.status) && <Card title="3. Record payment collected">
        <div className="mb-2 rounded-lg bg-stone-50 p-2 text-sm">{a.lines.filter((l) => /penalty|fee ×|Extra|damage/i.test(l.label)).map((l, i) => <div key={i} className="flex justify-between"><span>{l.label}</span><span>{peso(l.amount)}</span></div>)}<div className="flex justify-between text-lg font-bold"><span>Balance due</span><span className={a.balance ? 'text-red-600' : 'text-emerald-700'}>{peso(a.balance)}</span></div></div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Type"><select className={inputCls} value={pay.type} onChange={(e) => setPay({ ...pay, type: e.target.value as PaymentType })}><option value="balance">Balance</option><option value="penalty">Penalty / undeclared</option><option value="extra_guest">Extra guest</option>{s.security_deposit_amount > 0 && <><option value="deposit">Security deposit</option><option value="deposit_refund">Deposit refund</option></>}</select></Field>
          <Field label="Method"><select className={inputCls} value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value as 'cash' })}><option value="cash">Cash</option><option value="gcash">GCash</option></select></Field>
          <Field label="Amount (₱)"><input type="number" className={inputCls} value={pay.amount || ''} placeholder={String(pay.type === 'deposit' ? s.security_deposit_amount : a.balance)} onChange={(e) => setPay({ ...pay, amount: Number(e.target.value) })} /></Field>
          {pay.method === 'gcash' && <Field label="GCash ref"><input className={inputCls} value={pay.ref} onChange={(e) => setPay({ ...pay, ref: e.target.value })} /></Field>}
        </div>
        <div className="mt-2"><Field label="Photo (optional)"><input type="file" accept="image/*" capture="environment" className="text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPay({ ...pay, proof: (await fileToStored(f, 800)).dataUrl }); }} /></Field></div>
        <div className="mt-2 flex gap-2">
          <Btn variant="outline" onClick={() => setPay({ ...pay, amount: pay.type === 'deposit' ? s.security_deposit_amount : a.balance })}>Fill {pay.type === 'deposit' ? 'deposit' : 'balance'}</Btn>
          <Btn className="flex-1" disabled={!(pay.amount > 0)} onClick={() => run((d, c) => E.recordPayment(d, c, b.id, { type: pay.type, method: pay.method, amount: pay.amount, reference_no: pay.ref, proof: pay.proof }), `Recorded ${peso(pay.amount)} ${pay.type}.`)}>Record payment</Btn>
        </div>
        {a.depositHeld > 0 && <p className="mt-2 text-xs">Deposit held: {peso(a.depositHeld)}</p>}
      </Card>}

      {b.status === 'confirmed' && <Card title="4–5. Checklist & check in">
        <div className="space-y-2">{items.map((c) => <label key={c} className={cx('flex items-center gap-3 rounded-xl border p-3 text-sm', check[c] && 'border-brand-500 bg-brand-50')}><input type="checkbox" className="h-5 w-5 accent-brand-600" checked={!!check[c]} onChange={(e) => setCheck({ ...check, [c]: e.target.checked })} />{c}{/remote/i.test(c) && <b className="ml-auto text-xs">{b.rooms_allowed === 2 ? 'BOTH remotes' : `${b.aircon_choice.toUpperCase()} remote only`}</b>}</label>)}</div>
        <Field label="Notes"><textarea className={inputCls + ' mt-2'} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <Btn className="mt-3 w-full text-base" disabled={b.actual_guests === null || !items.every((c) => check[c])} onClick={() => run((d, c) => E.checkIn(d, c, b.id, check, notes), 'Checked in ✓')}>✓ Mark checked in</Btn>
        {b.actual_guests === null && <p className="mt-1 text-xs text-stone-500">Save the headcount first.</p>}
      </Card>}

      {b.status === 'checked_in' && <Card title="Check-out">
        <div className="space-y-2">{s.checkout_checklist.map((c) => <label key={c} className={cx('flex items-center gap-3 rounded-xl border p-3 text-sm', outCheck[c] && 'border-brand-500 bg-brand-50')}><input type="checkbox" className="h-5 w-5 accent-brand-600" checked={!!outCheck[c]} onChange={(e) => setOutCheck({ ...outCheck, [c]: e.target.checked })} />{c}</label>)}</div>
        <div className="mt-2 grid grid-cols-3 gap-2"><div className="col-span-2"><Field label="Extra charge (damage etc.)"><input className={inputCls} value={extra.label} onChange={(e) => setExtra({ ...extra, label: e.target.value })} placeholder="e.g. Broken glass" /></Field></div><Field label="₱"><input type="number" className={inputCls} value={extra.amount || ''} onChange={(e) => setExtra({ ...extra, amount: Number(e.target.value) })} /></Field></div>
        <Field label="Issues / notes"><textarea className={inputCls + ' mt-2'} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        {a.depositHeld > 0 && <p className="mt-2 rounded bg-amber-50 p-2 text-sm">Refund deposit {peso(a.depositHeld)} minus any unpaid charges — record it above as “Deposit refund”.</p>}
        {a.balance > 0 && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-700">Balance of {peso(a.balance)} still unpaid.</p>}
        <Btn className="mt-3 w-full text-base" disabled={!s.checkout_checklist.every((c) => outCheck[c])} onClick={() => run((d, c) => E.checkOut(d, c, b.id, outCheck, notes, extra.label && extra.amount > 0 ? { label: `Extra charge: ${extra.label}`, amount: extra.amount } : null), 'Checked out ✓ Thank-you email + receipt sent.')}>Mark checked out</Btn>
      </Card>}
    </div>
  </AppShell>;
}
