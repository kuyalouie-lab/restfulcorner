'use client';
import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/shell';
import { Allotment, Btn, Card, Field, Loading, Modal, SourceBadge, StatusBadge, inputCls, useQuery } from '@/components/ui';
import { useStore } from '@/lib/store';
import { fmtDate, fmtDateTime, peso } from '@/lib/dates';
import * as E from '@/lib/engine';
import { amountsFor } from '@/lib/money';
import { notifyGuest } from '@/lib/notify';
import type { Aircon } from '@/lib/types';

export default function BookingDetail() {
  const { db, act } = useStore();
  const id = useQuery('id');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [modal, setModal] = useState<null | 'decline' | 'reject' | 'edit' | 'refund' | 'img'>(null);
  const [reason, setReason] = useState('');
  const [payId, setPayId] = useState('');
  const [img, setImg] = useState('');
  const [edit, setEdit] = useState({ ci: '', co: '', g: 0, inf: 0, ac: 'sala' as Aircon });
  const [refund, setRefund] = useState({ amount: 0, ref: '' });

  if (!db || id === undefined) return <AppShell role="admin"><Loading /></AppShell>;
  const b = db.bookings.find((x) => x.id === id);
  if (!b) return <AppShell role="admin"><Card>Not found.</Card></AppShell>;
  const a = amountsFor(db, b);
  const pays = db.payments.filter((p) => p.booking_id === b.id);
  const ids = db.guest_ids.filter((g) => g.booking_id === b.id);
  const rec = db.checkin_records.find((r) => r.booking_id === b.id);
  const inv = db.invoices.find((i) => i.booking_id === b.id);
  const logs = db.message_log.filter((m) => m.booking_id === b.id);
  const audit = db.audit_log.filter((x) => x.entity_id === b.id || pays.some((p) => p.id === x.entity_id));
  const dpVerified = pays.some((p) => p.type === 'downpayment' && p.status === 'verified');
  const run = (fn: Parameters<typeof act>[0], msg: string) => { setErr(''); setOk(''); try { act(fn); setOk(msg); setModal(null); setReason(''); } catch (e) { setErr((e as Error).message); } };

  return <AppShell role="admin">
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Link href="/admin/bookings/" className="text-sm text-stone-500">← Bookings</Link>
      <h1 className="font-mono text-xl font-bold">{b.code}</h1><StatusBadge s={b.status} /><SourceBadge s={b.source} />
    </div>
    {err && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{err.replace(/_/g, ' ')}</p>}
    {ok && <p className="mb-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">{ok}</p>}

    <div className="mb-4 flex flex-wrap gap-2">
      {['payment_submitted', 'pending_payment'].includes(b.status) && <Btn disabled={!dpVerified} title={dpVerified ? '' : 'Verify the downpayment first'} onClick={() => run((d, c) => E.approveBooking(d, c, b.id), 'Approved — confirmation + invoice sent.')}>✓ Approve</Btn>}
      {['pending_payment', 'payment_submitted', 'confirmed'].includes(b.status) && <Btn variant="danger" onClick={() => setModal('decline')}>Decline</Btn>}
      {['pending_payment', 'payment_submitted', 'confirmed'].includes(b.status) && <Btn variant="outline" onClick={() => { if (confirm('Cancel this booking? (refund will be marked due if paid)')) run((d, c) => E.cancelBooking(d, c, b.id, confirm('Refund the guest?')), 'Cancelled.'); }}>Cancel booking</Btn>}
      {b.status === 'refund_due' && <Btn onClick={() => { setRefund({ amount: a.paid, ref: '' }); setModal('refund'); }}>Mark refunded</Btn>}
      {!['checked_out', 'expired', 'declined', 'cancelled'].includes(b.status) && <Btn variant="outline" onClick={() => { setEdit({ ci: b.check_in_date, co: b.check_out_date, g: b.declared_guests, inf: b.infants, ac: b.aircon_choice === 'bedroom' ? 'bedroom' : 'sala' }); setModal('edit'); }}>Edit dates / guests</Btn>}
      {b.status === 'confirmed' && <Btn variant="outline" onClick={() => run((d, c) => notifyGuest(d, c, d.bookings.find((x) => x.id === b.id)!, 'approved', ['email', 'sms']), 'Confirmation re-sent.')}>Resend confirmation</Btn>}
      {inv && <Btn variant="outline" onClick={() => run((d, c) => E.issueInvoice(d, c, d.bookings.find((x) => x.id === b.id)!), 'Invoice regenerated (same number, new revision).')}>Regenerate invoice</Btn>}
      {inv && <Link className="inline-flex min-h-[44px] items-center rounded-xl border px-4 text-sm font-semibold" href={`/invoice/?id=${b.id}`}>📄 Invoice</Link>}
      <Link className="inline-flex min-h-[44px] items-center rounded-xl border px-4 text-sm font-semibold" href={`/guest-list/?id=${b.id}`}>🖨 Guest list</Link>
      {b.source !== 'airbnb' && <button className="text-xs text-stone-500 underline" onClick={() => { navigator.clipboard?.writeText(`${location.origin}/b/?code=${b.code}&t=${b.guest_token}`); setOk('Guest link copied.'); }}>Copy guest link</button>}
      {b.source === 'airbnb' && <button className="text-xs text-brand-700 underline" onClick={() => { navigator.clipboard?.writeText(`${location.origin}/b/?code=${b.code}&t=${b.guest_token}`); setOk('Guest registration link copied — paste it into Airbnb chat so the guest can enter all names for the condo guard.'); }}>Copy guest-registration link (for Airbnb chat)</button>}
    </div>

    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card title="Stay">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="text-sm"><div><b>{fmtDate(b.check_in_date)}</b> → <b>{fmtDate(b.check_out_date)}</b> ({b.nights} night{b.nights > 1 ? 's' : ''})</div>
              <div>Declared: <b>{b.declared_guests}</b> counted + {b.infants} infant(s)</div>
              {b.actual_guests !== null && <div>Actual: <b>{b.actual_guests}</b> {b.undeclared_guests > 0 && <span className="font-bold text-red-600">({b.undeclared_guests} undeclared)</span>}</div>}
              {b.hold_expires_at && <div className="text-amber-700">Hold expires {fmtDateTime(b.hold_expires_at)}</div>}
              {b.decline_reason && <div className="text-red-700">Reason: {b.decline_reason}</div>}
              {b.cancel_requested_at && <div className="font-semibold text-orange-700">Guest requested cancellation {fmtDateTime(b.cancel_requested_at)}</div>}
            </div>
            <Allotment b={b} s={db.settings} big />
          </div>
        </Card>
        {b.pending_change && <Card title="⏳ Guest change request" className="border-amber-300 bg-amber-50">
          <p className="text-sm">{b.declared_guests} → <b>{b.pending_change.declared_guests}</b> guests. New names: {b.pending_change.names.join(', ')}</p>
          <p className="text-sm">New total: {peso(amountsFor(db, b, b.pending_change.declared_guests).charges)} (now {peso(a.charges)})</p>
          <div className="mt-2 flex gap-2"><Btn onClick={() => run((d, c) => E.resolveGuestChange(d, c, b.id, true), 'Guest change approved; price & invoice updated.')}>Approve change</Btn><Btn variant="ghost" onClick={() => run((d, c) => E.resolveGuestChange(d, c, b.id, false), 'Change rejected.')}>Reject</Btn></div>
        </Card>}
        <Card title="Special requests / anything we should know"><p className="whitespace-pre-wrap text-sm">{b.special_requests || '—'}</p></Card>
        <Card title="Payments">
          {!pays.length ? <p className="text-sm text-stone-500">No payments yet.</p> : <ul className="divide-y">{pays.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <div><b className="capitalize">{p.type.replace('_', ' ')}</b> · {p.method} · {peso(p.amount)} {p.reference_no && <span className="text-stone-500">ref {p.reference_no}</span>}
              <div className="text-xs text-stone-500">{fmtDateTime(p.created_at)} · by {p.recorded_by} · <span className={p.status === 'verified' ? 'text-emerald-700' : p.status === 'rejected' ? 'text-red-600' : 'text-sky-700'}>{p.status}</span>{p.reject_reason && ` (${p.reject_reason})`}</div></div>
            <div className="flex items-center gap-2">
              {p.proof_path && <button onClick={() => { setImg(p.proof_path!); setModal('img'); }}><img src={p.proof_path} alt="proof" className="h-14 w-10 rounded border object-cover" /></button>}
              {p.status === 'submitted' && <><Btn className="!min-h-[36px]" onClick={() => run((d, c) => E.verifyPayment(d, c, p.id), 'Payment verified. You can now approve.')}>Verify</Btn><Btn variant="ghost" className="!min-h-[36px] text-red-600" onClick={() => { setPayId(p.id); setModal('reject'); }}>Reject</Btn></>}
            </div>
          </li>)}</ul>}
        </Card>
        <Card title="Messages sent">
          {!logs.length ? <p className="text-sm text-stone-500">None.</p> : <ul className="space-y-1 text-xs">{logs.map((m) => <li key={m.id}><details><summary className="cursor-pointer"><b>{m.channel.toUpperCase()}</b> {m.template} → {m.to} · {fmtDateTime(m.sent_at)} · <span className={m.status === 'failed' ? 'text-red-600' : ''}>{m.status}</span></summary><pre className="mt-1 whitespace-pre-wrap rounded bg-stone-50 p-2">{m.subject ? m.subject + '\n\n' : ''}{m.body}</pre></details></li>)}</ul>}
        </Card>
        <Card title="Audit log"><ul className="space-y-1 text-xs">{audit.map((x) => <li key={x.id}>{fmtDateTime(x.created_at)} · <b>{x.actor_id}</b> · {x.action} {x.data ? <code className="text-stone-500">{JSON.stringify(x.data).slice(0, 120)}</code> : null}</li>)}{!audit.length && <li className="text-stone-500">—</li>}</ul></Card>
      </div>

      <div className="space-y-4">
        <Card title="Booker">
          <div className="space-y-1 text-sm"><div className="font-semibold">{b.booker_name}</div><div><a className="underline" href={`tel:${b.booker_mobile}`}>{b.booker_mobile}</a></div><div className="break-all">{b.booker_email}</div><div className="text-xs text-stone-500">Language: {b.language.toUpperCase()}</div>
            {b.rules_accepted_at && <div className="text-xs text-stone-500">Rules & penalty accepted {fmtDateTime(b.rules_accepted_at)} · IP {b.rules_accepted_ip}</div>}
            {b.privacy_consent_at && <div className="text-xs text-stone-500">Privacy consent {fmtDateTime(b.privacy_consent_at)}</div>}</div>
        </Card>
        <Card title="Valid ID (admin only)">
          {ids.length ? ids.map((g) => <div key={g.id}><button onClick={() => { setImg(g.storage_path); setModal('img'); }}><img src={g.storage_path} alt="Guest ID" className="w-full rounded-lg border blur-sm transition hover:blur-0" /></button><div className="mt-1 text-xs text-stone-500">{g.file_name} · {g.delete_after ? `auto-delete ${g.delete_after}` : 'deleted 30 days after check-out'}</div></div>) : <p className="text-sm text-stone-500">{b.source === 'airbnb' ? 'Airbnb booking — verified by Airbnb.' : 'Deleted (privacy retention) or not uploaded.'}</p>}
        </Card>
        <Card title="Guest list">
          <ol className="list-decimal pl-5 text-sm">{b.guests.map((g) => <li key={g.id}>{g.full_name}{g.age_group === 'infant' ? ' 👶' : ''}{g.is_booker ? ' ★' : ''}</li>)}</ol>
        </Card>
        <Card title="Amounts">
          <div className="space-y-1 text-sm">
            {a.lines.map((l, i) => <div key={i} className="flex justify-between gap-2"><span>{l.label}</span><span className="tabular-nums">{peso(l.amount)}</span></div>)}
            <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>{peso(a.charges)}</span></div>
            <div className="flex justify-between text-emerald-700"><span>Paid (verified)</span><span>{peso(a.paid)}</span></div>
            <div className="flex justify-between text-lg font-bold"><span>Balance</span><span>{peso(a.balance)}</span></div>
            {a.depositHeld > 0 && <div className="flex justify-between text-xs"><span>Security deposit held</span><span>{peso(a.depositHeld)}</span></div>}
            {inv && <div className="text-xs text-stone-500">Invoice {inv.number}{inv.revision ? ` · rev ${inv.revision}` : ''}</div>}
          </div>
        </Card>
        {rec && <Card title="Check-in record"><div className="text-xs"><div>In: {rec.checked_in_at ? fmtDateTime(rec.checked_in_at) : '—'} · Out: {rec.checked_out_at ? fmtDateTime(rec.checked_out_at) : '—'}</div>{Object.entries(rec.checklist).map(([k, v]) => <div key={k}>{v ? '☑' : '☐'} {k}</div>)}{rec.notes && <p className="mt-1 whitespace-pre-wrap">{rec.notes}</p>}</div></Card>}
      </div>
    </div>

    <Modal open={modal === 'decline' || modal === 'reject'} onClose={() => setModal(null)} title={modal === 'decline' ? 'Decline booking' : 'Reject payment'}>
      <Field label="Reason (sent to the guest)"><textarea className={inputCls} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      <Btn variant="danger" className="mt-3 w-full" disabled={!reason.trim()} onClick={() => modal === 'decline' ? run((d, c) => E.declineBooking(d, c, b.id, reason), 'Declined. Guest notified.') : run((d, c) => E.rejectPayment(d, c, payId, reason), 'Payment rejected. Guest notified; hold restarted.')}>Confirm</Btn>
    </Modal>
    <Modal open={modal === 'refund'} onClose={() => setModal(null)} title="Mark refunded (manual GCash)">
      <div className="space-y-2"><Field label="Amount"><input type="number" className={inputCls} value={refund.amount} onChange={(e) => setRefund({ ...refund, amount: Number(e.target.value) })} /></Field>
        <Field label="GCash reference"><input className={inputCls} value={refund.ref} onChange={(e) => setRefund({ ...refund, ref: e.target.value })} /></Field>
        <Btn className="w-full" onClick={() => run((d, c) => E.markRefunded(d, c, b.id, refund.amount, refund.ref), 'Refund recorded.')}>Save</Btn></div>
    </Modal>
    <Modal open={modal === 'edit'} onClose={() => setModal(null)} title="Edit booking (price recalculated, audit-logged)">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Check-in"><input type="date" className={inputCls} value={edit.ci} onChange={(e) => setEdit({ ...edit, ci: e.target.value })} /></Field>
        <Field label="Check-out"><input type="date" className={inputCls} value={edit.co} onChange={(e) => setEdit({ ...edit, co: e.target.value })} /></Field>
        <Field label="Counted guests"><input type="number" min={1} max={db.settings.max_guests} className={inputCls} value={edit.g} onChange={(e) => setEdit({ ...edit, g: Number(e.target.value) })} /></Field>
        <Field label="Infants"><input type="number" min={0} className={inputCls} value={edit.inf} onChange={(e) => setEdit({ ...edit, inf: Number(e.target.value) })} /></Field>
        {edit.g <= 3 && <Field label="Aircon"><select className={inputCls} value={edit.ac} onChange={(e) => setEdit({ ...edit, ac: e.target.value as Aircon })}><option value="sala">Sala</option><option value="bedroom">Bedroom</option></select></Field>}
      </div>
      <Btn className="mt-3 w-full" onClick={() => run((d, c) => E.adminEditBooking(d, c, b.id, { check_in_date: edit.ci, check_out_date: edit.co, declared_guests: edit.g, infants: edit.inf, aircon_choice: edit.g <= 3 ? edit.ac : 'both' }), 'Booking updated.')}>Save changes</Btn>
    </Modal>
    <Modal open={modal === 'img'} onClose={() => setModal(null)} title="Image (signed URL — admin only)"><img src={img} alt="" className="mx-auto max-h-[70vh]" /></Modal>
  </AppShell>;
}
