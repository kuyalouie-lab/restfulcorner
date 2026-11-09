'use client';
import Link from 'next/link';
import { useState } from 'react';
import { SiteShell } from '@/components/site';
import { Allotment, Btn, Card, Countdown, Field, Loading, StatusBadge, inputCls, useQuery } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { fileToStored, useStore } from '@/lib/store';
import { fmtDate, fmtTime, peso } from '@/lib/dates';
import { BookingError, beforeCutoff, findByToken, requestCancel, requestGuestChange, submitPaymentProof } from '@/lib/engine';
import { amountsFor } from '@/lib/money';
import { calculatePrice } from '@/lib/pricing';

export default function BookingPage() {
  const { t, lang } = useT();
  const { db, act } = useStore();
  const code = useQuery('code');
  const tok = useQuery('t');
  const [ref, setRef] = useState('');
  const [proof, setProof] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [newNames, setNewNames] = useState<string[]>([]);

  if (!db || code === undefined || tok === undefined) return <SiteShell><Loading /></SiteShell>;
  const b = code ? findByToken(db, code, tok) : null;
  if (!b) return <SiteShell><div className="mx-auto max-w-lg px-4 py-10"><Card><p>{t.err.invalid_link}</p></Card></div></SiteShell>;
  const s = db.settings;
  const a = amountsFor(db, b);
  const inv = db.invoices.find((i) => i.booking_id === b.id);
  const canEdit = ['payment_submitted', 'confirmed'].includes(b.status) && beforeCutoff(db, b, new Date()) && !b.pending_change;
  const run = (fn: () => void, ok: string) => { setErr(null); try { fn(); setMsg(ok); } catch (e) { setErr(e instanceof BookingError ? (t.err[e.message] ?? e.message) : String(e)); } };
  const adultNames = b.guests.filter((g) => g.age_group !== 'infant').map((g) => g.full_name);

  return <SiteShell>
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><div className="text-xs text-stone-500">{t.your_booking}</div><h1 className="text-xl font-bold">{b.code}</h1></div>
        <StatusBadge s={b.status} label={t.st[b.status]} />
      </div>
      {msg && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</p>}
      {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}

      {b.status === 'pending_payment' && <Card title={t.pay_title}>
        <div className="space-y-3">
          <div className="rounded-xl bg-amber-50 p-3 text-center"><div className="text-xs text-amber-800">{t.hold_left}</div><Countdown to={b.hold_expires_at!} /></div>
          <div className="flex items-center gap-4">
            {s.gcash_qr_path ? <img src={s.gcash_qr_path} alt="GCash QR" className="h-32 w-32 rounded-lg border" /> : <DemoQR />}
            <div className="text-sm"><div className="text-stone-500">{t.pay_to}</div><div className="font-semibold">{s.gcash_name}</div><div className="font-mono">{s.gcash_number}</div><div className="mt-2 text-stone-500">{t.amount}</div><div className="text-2xl font-bold text-brand-700">{peso(s.downpayment_amount)}</div></div>
          </div>
          <Field label={t.ref_no}><input className={inputCls} inputMode="numeric" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="1234 567 890123" /></Field>
          <Field label={t.upload_proof}><input type="file" accept="image/*" className="block w-full text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (f) try { setProof((await fileToStored(f, 900)).dataUrl); } catch { setErr(t.err.file_too_big); } }} /></Field>
          {proof && <img src={proof} alt="" className="max-h-40 rounded border" />}
          <Btn className="w-full" onClick={() => run(() => act((d, c) => submitPaymentProof(d, c, b.code, b.guest_token, ref, proof), 'guest'), t.thanks_submitted)}>{t.send_proof}</Btn>
        </div>
      </Card>}
      {b.status === 'expired' && <Card><p className="text-sm">{t.expired_note}</p><Link href="/book/" className="mt-2 inline-block font-semibold text-brand-700 underline">{t.book_now}</Link></Card>}
      {b.decline_reason && ['declined', 'refund_due'].includes(b.status) && <Card><p className="text-sm">{b.decline_reason}</p></Card>}

      <Card title={`${fmtDate(b.check_in_date, lang)} → ${fmtDate(b.check_out_date, lang)}`}>
        <p className="mb-2 text-sm text-stone-600">Check-in {fmtTime(s.checkin_time)} · Check-out {fmtTime(s.checkout_time)} · {b.nights} {b.nights > 1 ? t.nights : t.night}</p>
        <div className="mb-2 text-xs font-semibold uppercase text-stone-500">{t.allotment}</div>
        <Allotment b={b} s={s} lang={lang} />
        <p className="mt-3 rounded-lg bg-sky-50 p-2 text-sm">🪪 {t.lobby_reminder}</p>
      </Card>

      <Card title={`${t.guest_list} (${b.declared_guests}${b.infants ? ` + ${b.infants}` : ''})`} right={canEdit && !editing && <Btn variant="outline" className="!min-h-[36px] text-xs" onClick={() => { setNewNames(adultNames); setEditing(true); }}>{t.add_guests}</Btn>}>
        {b.pending_change && <p className="mb-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">⏳ {t.change_pending}: {b.pending_change.declared_guests}</p>}
        {!editing ? <ol className="list-decimal space-y-1 pl-5 text-sm">{b.guests.map((g) => <li key={g.id}>{g.full_name}{g.age_group === 'infant' && ' 👶'}{g.is_booker && ' ★'}</li>)}</ol> : <div className="space-y-2">
          {newNames.map((n, i) => <input key={i} className={inputCls} value={n} placeholder={t.guest_name(i + 1)} onChange={(e) => setNewNames(newNames.map((x, j) => (j === i ? e.target.value : x)))} />)}
          {newNames.length < s.max_guests && <Btn variant="ghost" onClick={() => setNewNames([...newNames, ''])}>+ {lang === 'fil' ? 'Magdagdag ng bisita' : 'Add guest'} ({peso(s.extra_guest_fee)}/{t.night})</Btn>}
          {newNames.length > b.declared_guests && b.source !== 'airbnb' && <p className="text-sm">{t.total}: {peso(calculatePrice(s, newNames.length, b.nights).total)} <span className="text-stone-500">(+{peso(calculatePrice(s, newNames.length, b.nights).total - (b.price_breakdown?.total ?? 0))})</span></p>}
          <div className="flex gap-2"><Btn onClick={() => run(() => { act((d, c) => requestGuestChange(d, c, b.code, b.guest_token, newNames.length, newNames), 'guest'); setEditing(false); }, newNames.length > b.declared_guests ? t.change_pending : '✓')}>{newNames.length > b.declared_guests ? t.save_changes : '✓ Save'}</Btn><Btn variant="ghost" onClick={() => setEditing(false)}>{t.back}</Btn></div>
        </div>}
        {['payment_submitted', 'confirmed'].includes(b.status) && <p className="mt-2 text-xs text-stone-500">{t.manage_cutoff}</p>}
      </Card>

      <Card title={t.amounts}>
        <div className="space-y-1 text-sm">
          {a.lines.map((l, i) => <div key={i} className="flex justify-between gap-2"><span>{l.label}</span><span className="tabular-nums">{peso(l.amount)}</span></div>)}
          <div className="flex justify-between border-t pt-1 font-semibold"><span>{t.total}</span><span>{peso(a.charges)}</span></div>
          <div className="flex justify-between text-emerald-700"><span>{t.paid}</span><span>{peso(a.paid)}</span></div>
          {a.pending > 0 && <div className="flex justify-between text-sky-700"><span>Pending verification</span><span>{peso(a.pending)}</span></div>}
          <div className="flex justify-between text-lg font-bold"><span>{t.due}</span><span>{peso(a.balance)}</span></div>
        </div>
        {inv && ['confirmed', 'checked_in', 'checked_out'].includes(b.status) && <Link href={`/invoice/?code=${b.code}&t=${b.guest_token}`} className="mt-3 inline-block font-semibold text-brand-700 underline">📄 {t.invoice}</Link>}
      </Card>

      {['pending_payment', 'payment_submitted', 'confirmed'].includes(b.status) && <div className="text-center">
        {b.cancel_requested_at ? <p className="text-sm text-stone-500">{t.cancel_sent}</p> : <Btn variant="ghost" className="text-red-600" onClick={() => { if (confirm(t.request_cancel + '?')) run(() => act((d, c) => requestCancel(d, c, b.code, b.guest_token), 'guest'), t.cancel_sent); }}>{t.request_cancel}</Btn>}
      </div>}
      <p className="text-center text-xs text-stone-400"><Link href="/rules/" className="underline">{t.nav_rules}</Link></p>
    </div>
  </SiteShell>;
}

function DemoQR() {
  const cells = Array.from({ length: 21 * 21 }, (_, i) => ((i * 7919) % 13 < 6 ? 1 : 0));
  return <svg viewBox="0 0 21 21" className="h-32 w-32 rounded-lg border bg-white p-1" aria-label="Demo GCash QR">{cells.map((c, i) => c ? <rect key={i} x={i % 21} y={Math.floor(i / 21)} width="1" height="1" /> : null)}{[[0, 0], [14, 0], [0, 14]].map(([x, y]) => <g key={x + '-' + y}><rect x={x} y={y} width="7" height="7" fill="black" /><rect x={x + 1} y={y + 1} width="5" height="5" fill="white" /><rect x={x + 2} y={y + 2} width="3" height="3" fill="black" /></g>)}</svg>;
}
