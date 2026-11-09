'use client';
import { Allotment, Btn, Loading, useQuery } from '@/components/ui';
import { useStore } from '@/lib/store';
import { fmtDate, fmtDateTime, peso } from '@/lib/dates';
import { findByToken } from '@/lib/engine';
import { amountsFor } from '@/lib/money';

/** Printable invoice (billing statement). Production: @react-pdf/renderer PDF attached to the confirmation email. */
export default function InvoicePage() {
  const { db, role } = useStore();
  const id = useQuery('id'), code = useQuery('code'), t = useQuery('t');
  if (!db || id === undefined || code === undefined) return <Loading />;
  const b = id && (role === 'admin' || role === 'staff') ? db.bookings.find((x) => x.id === id) : code ? findByToken(db, code, t ?? null) : null;
  const inv = b && db.invoices.find((i) => i.booking_id === b.id);
  if (!b || !inv) return <p className="p-6">Invoice not available.</p>;
  const a = amountsFor(db, b);
  const pays = db.payments.filter((p) => p.booking_id === b.id && p.status === 'verified');
  return <div className="mx-auto max-w-[210mm] bg-white p-8 text-sm print:p-0">
    <div className="no-print mb-4 flex gap-2"><Btn onClick={() => window.print()}>⬇ Download PDF (Print → Save as PDF)</Btn><Btn variant="ghost" onClick={() => history.back()}>Back</Btn></div>
    <div className="flex items-start justify-between border-b pb-4">
      <div><div className="text-xl font-extrabold text-brand-700">The Restful Corner</div><div className="text-xs text-stone-600">2BR Staycation · Quezon City, Philippines<br />facebook.com/therestfulcorner · {db.settings.owner_email}</div></div>
      <div className="text-right"><div className="text-lg font-bold">BILLING STATEMENT</div><div className="font-mono">{inv.number}</div><div className="text-xs">Issued {fmtDateTime(inv.issued_at)}{inv.revision > 0 && <><br />Revision {inv.revision} · {fmtDateTime(inv.revised_at!)}</>}</div></div>
    </div>
    <div className="my-4 grid grid-cols-2 gap-4">
      <div><div className="text-xs uppercase text-stone-500">Billed to</div><div className="font-semibold">{b.booker_name}</div><div>{b.booker_mobile}</div><div>{b.booker_email}</div></div>
      <div><div className="text-xs uppercase text-stone-500">Booking</div><div className="font-mono font-semibold">{b.code}</div><div>{fmtDate(b.check_in_date)} → {fmtDate(b.check_out_date)} ({b.nights} night{b.nights > 1 ? 's' : ''})</div><div>Declared guests: {b.declared_guests}{b.infants ? ` + ${b.infants} infant(s)` : ''}</div></div>
    </div>
    <Allotment b={b} s={db.settings} />
    <table className="mt-4 w-full"><thead><tr className="border-b text-left text-xs uppercase text-stone-500"><th className="py-1">Description</th><th className="text-right">Amount</th></tr></thead>
      <tbody>{a.lines.map((l, i) => <tr key={i} className="border-b"><td className="py-1.5">{l.label}</td><td className="text-right tabular-nums">{peso(l.amount)}</td></tr>)}
        <tr className="font-bold"><td className="py-2">Total</td><td className="text-right">{peso(a.charges)}</td></tr></tbody></table>
    <div className="mt-2 text-xs uppercase text-stone-500">Payments received</div>
    <table className="w-full"><tbody>{pays.filter((p) => p.type !== 'deposit' && p.type !== 'deposit_refund').map((p) => <tr key={p.id} className="border-b"><td className="py-1 capitalize">{p.type.replace('_', ' ')} · {p.method}{p.reference_no ? ` · ref ${p.reference_no}` : ''} · {fmtDateTime(p.verified_at ?? p.created_at)}</td><td className="text-right tabular-nums">{p.type === 'refund' ? '−' : ''}{peso(p.amount)}</td></tr>)}</tbody></table>
    <div className="mt-3 flex justify-end"><div className="w-64 space-y-1"><div className="flex justify-between"><span>Paid</span><span>{peso(a.paid)}</span></div><div className="flex justify-between border-t pt-1 text-lg font-bold"><span>Balance due</span><span>{peso(a.balance)}</span></div></div></div>
    <p className="mt-8 border-t pt-3 text-center text-xs text-stone-500">This is a billing statement, not a BIR Official Receipt.</p>
  </div>;
}
