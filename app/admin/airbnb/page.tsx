'use client';
import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/shell';
import { Btn, Card, Field, Loading, Modal, inputCls } from '@/components/ui';
import { useStore } from '@/lib/store';
import { fmtDateTime, manilaToday } from '@/lib/dates';
import { convertAirbnbBlock, importAirbnbIcal } from '@/lib/engine';
import { buildIcal } from '@/lib/ical';
import { demoAirbnbIcal } from '@/lib/seed';
import type { Aircon } from '@/lib/types';

export default function AirbnbSync() {
  const { db, act } = useStore();
  const [paste, setPaste] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [conv, setConv] = useState<string | null>(null);
  const [f, setF] = useState({ name: '', mobile: '', email: '', guests: 2, infants: 0, payout: 0, aircon: 'sala' as Aircon });
  if (!db) return <AppShell role="admin"><Loading /></AppShell>;
  const sync = (ics: string) => { setErr(''); try { const r = act((d, c) => importAirbnbIcal(d, c, ics)); setMsg(`Synced: ${r.added} added, ${r.updated} updated, ${r.removed} removed.`); } catch (e) { setErr((e as Error).message); act(() => undefined); } };
  const exportUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/ical/${db.settings.ical_export_token}.ics`;
  const blocks = db.calendar_blocks.filter((k) => k.source === 'airbnb_ical').sort((a, b) => a.start_date.localeCompare(b.start_date));
  const download = () => { const blob = new Blob([buildIcal(db)], { type: 'text/calendar' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'restful-corner.ics'; a.click(); };

  return <AppShell role="admin">
    <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">⚠️ Airbnb sync can lag by a few hours. Check Airbnb before approving last-minute direct bookings.</p>
    {msg && <p className="mb-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">{msg}</p>}
    {err && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Import from Airbnb (every 30 min)">
        <div className="space-y-2 text-sm">
          <div>Import URL: <code className="break-all text-xs">{db.settings.airbnb_ical_import_url || '— set in Settings —'}</code></div>
          <div>Last synced: <b>{db.sync.last_synced_at ? fmtDateTime(db.sync.last_synced_at) : 'never'}</b>{db.sync.last_error && <span className="text-red-600"> · Error: {db.sync.last_error}</span>}</div>
          <Btn onClick={() => sync(demoAirbnbIcal(manilaToday()))}>Sync now (demo Airbnb feed)</Btn>
          <p className="text-xs text-stone-500">Demo: the browser can’t fetch Airbnb directly (CORS), so “Sync now” uses a sample feed. In production a pg_cron job calls <code>/api/jobs/airbnb-sync</code> every 30 minutes. You can also paste an exported .ics below.</p>
          <textarea className={inputCls + ' font-mono text-xs'} rows={4} placeholder="BEGIN:VCALENDAR…" value={paste} onChange={(e) => setPaste(e.target.value)} />
          <Btn variant="outline" disabled={!paste.trim()} onClick={() => sync(paste)}>Import pasted iCal</Btn>
        </div>
      </Card>
      <Card title="Export to Airbnb">
        <div className="space-y-2 text-sm">
          <p>Give Airbnb this URL so direct bookings and manual blocks close those dates on Airbnb:</p>
          <code className="block break-all rounded bg-stone-50 p-2 text-xs">{exportUrl}</code>
          <ol className="list-decimal pl-5 text-xs text-stone-600"><li>Airbnb → Calendar → Availability → Sync calendars → Import calendar.</li><li>Paste the URL above, name it “Restful Corner direct”.</li><li>Airbnb refreshes it every few hours.</li></ol>
          <Btn variant="outline" onClick={download}>Download current .ics (validate at icalendar.org)</Btn>
          <p className="text-xs text-stone-500">Demo is static, so the URL is served by the production API route; the download is the same feed.</p>
        </div>
      </Card>
    </div>
    <Card title="Airbnb blocks" className="mt-4">
      <p className="mb-2 text-xs text-stone-500">Airbnb iCal has no names or guest counts. Convert a block to an Airbnb booking to get the same check-in flow, guest list and sales tracking.</p>
      <ul className="divide-y">{blocks.map((k) => <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
        <span>{k.start_date} → {k.end_date} <span className="text-xs text-stone-400">{k.external_uid}</span></span>
        {k.converted_booking_id ? <Link className="text-brand-700 underline" href={`/admin/booking/?id=${k.converted_booking_id}`}>Converted → view booking</Link> : <Btn variant="outline" className="!min-h-[36px]" onClick={() => { setConv(k.id); setF({ name: '', mobile: '', email: '', guests: 2, infants: 0, payout: 0, aircon: 'sala' }); }}>Convert to Airbnb booking</Btn>}
      </li>)}{!blocks.length && <li className="py-2 text-sm text-stone-500">No Airbnb blocks.</li>}</ul>
    </Card>
    <Modal open={!!conv} onClose={() => setConv(null)} title="Convert to Airbnb booking">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2"><Field label="Guest name"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
        <Field label="Mobile (optional)"><input className={inputCls} value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} /></Field>
        <Field label="Email (optional)"><input className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Counted guests"><input type="number" min={1} max={db.settings.max_guests} className={inputCls} value={f.guests} onChange={(e) => setF({ ...f, guests: Number(e.target.value) })} /></Field>
        <Field label="Infants"><input type="number" min={0} className={inputCls} value={f.infants} onChange={(e) => setF({ ...f, infants: Number(e.target.value) })} /></Field>
        <Field label="Payout (₱)"><input type="number" className={inputCls} value={f.payout} onChange={(e) => setF({ ...f, payout: Number(e.target.value) })} /></Field>
        {f.guests <= 3 && <Field label="Aircon"><select className={inputCls} value={f.aircon} onChange={(e) => setF({ ...f, aircon: e.target.value as Aircon })}><option value="sala">Sala</option><option value="bedroom">Bedroom</option></select></Field>}
      </div>
      <Btn className="mt-3 w-full" disabled={!f.name.trim()} onClick={() => { const b = act((d, c) => convertAirbnbBlock(d, c, conv!, f)); setConv(null); setMsg(`Created ${b.code}. Copy its guest-registration link from the booking page and paste it into Airbnb chat.`); }}>Create booking</Btn>
    </Modal>
  </AppShell>;
}
