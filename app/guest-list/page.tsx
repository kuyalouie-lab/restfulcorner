'use client';
import { RoleGate } from '@/components/shell';
import { Allotment, Btn, Loading, useQuery } from '@/components/ui';
import { useStore } from '@/lib/store';
import { fmtDate, fmtTime } from '@/lib/dates';
import { poolLimit } from '@/lib/pricing';

/** Printable A4 guest list for the condo guard / admin. */
export default function GuestList() {
  const { db } = useStore();
  const id = useQuery('id');
  const b = db?.bookings.find((x) => x.id === id);
  return <RoleGate allow={['admin', 'staff']}>
    {!db || id === undefined ? <Loading /> : !b ? <p className="p-6">Not found.</p> : <div className="mx-auto max-w-[210mm] bg-white p-8 print:p-0">
      <div className="no-print mb-4 flex gap-2"><Btn onClick={() => window.print()}>🖨 Print / Save as PDF</Btn><Btn variant="ghost" onClick={() => history.back()}>Back</Btn></div>
      <div className="flex items-start justify-between border-b-2 border-black pb-3">
        <div><h1 className="text-2xl font-extrabold">GUEST LIST</h1><div className="text-sm">The Restful Corner · Unit ____ (2BR) · Quezon City</div></div>
        <div className="text-right"><div className="font-mono text-xl font-bold">{b.code}</div><div className="text-xs">{b.source === 'airbnb' ? 'Airbnb' : 'Direct booking'}</div></div>
      </div>
      <table className="my-4 w-full text-sm"><tbody>
        <tr><td className="w-40 py-1 font-semibold">Check-in</td><td>{fmtDate(b.check_in_date)}, {fmtTime(db.settings.checkin_time)}</td></tr>
        <tr><td className="py-1 font-semibold">Check-out</td><td>{fmtDate(b.check_out_date)}, {fmtTime(db.settings.checkout_time)}</td></tr>
        <tr><td className="py-1 font-semibold">Booker</td><td>{b.booker_name} · {b.booker_mobile}</td></tr>
        <tr><td className="py-1 font-semibold">Declared guests</td><td className="text-lg font-bold">{b.declared_guests} (2 yrs+){b.infants ? ` + ${b.infants} infant(s)` : ''}</td></tr>
        <tr><td className="py-1 font-semibold">Pool limit</td><td className="font-bold">{poolLimit(db.settings, b.rooms_allowed)} persons</td></tr>
      </tbody></table>
      <Allotment b={b} s={db.settings} big />
      <table className="mt-4 w-full border-collapse text-sm">
        <thead><tr className="bg-stone-100"><th className="border border-black px-2 py-1 text-left">#</th><th className="border border-black px-2 py-1 text-left">Full name</th><th className="border border-black px-2 py-1 text-left">Type</th><th className="border border-black px-2 py-1 text-left">ID presented (guard)</th></tr></thead>
        <tbody>{b.guests.map((g, i) => <tr key={g.id}><td className="border border-black px-2 py-2">{i + 1}</td><td className="border border-black px-2 py-2 font-semibold">{g.full_name}{g.is_booker ? ' (booker)' : ''}</td><td className="border border-black px-2 py-2">{g.age_group === 'infant' ? 'Infant <2' : 'Guest'}</td><td className="w-40 border border-black px-2 py-2"></td></tr>)}</tbody>
      </table>
      <p className="mt-4 rounded border-2 border-black p-2 text-sm font-semibold">ONLY the names above may go up to the unit. Every guest must register and leave a valid ID at the lobby. Undeclared guests: please call the owner/staff.</p>
      <div className="mt-10 grid grid-cols-2 gap-10 text-xs"><div className="border-t border-black pt-1">Staff signature</div><div className="border-t border-black pt-1">Guard / admin signature</div></div>
    </div>}
  </RoleGate>;
}
