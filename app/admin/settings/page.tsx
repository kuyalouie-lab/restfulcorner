'use client';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shell';
import { Btn, Card, Field, Loading, inputCls } from '@/components/ui';
import { fileToStored, useStore } from '@/lib/store';
import { audit } from '@/lib/engine';
import type { Settings } from '@/lib/types';

const NUM: [keyof Settings, string, string?][] = [
  ['base_rate', 'Base nightly rate (₱)'], ['base_guests', 'Guests included in base rate'], ['extra_guest_fee', 'Extra guest fee per night (₱)'],
  ['max_guests', 'Max counted guests', '[ASSUMPTION] 7 = 2 + 5 extra. Owner to confirm (could be 5 total).'], ['cleaning_fee', 'Cleaning fee per stay (₱)'],
  ['downpayment_amount', 'GCash downpayment (₱)', '[ASSUMPTION] Deducted from the total.'], ['security_deposit_amount', 'Security deposit at check-in (₱, 0 = off)', '[ASSUMPTION] Optional. Penalties deducted, rest refunded at check-out.'],
  ['undeclared_penalty', 'Penalty per undeclared guest (₱)', 'Extra guest fee is added on top (₱2,000 + ₱500 = ₱2,500).'], ['hold_hours', 'Payment hold (hours)'],
  ['pool_limit_per_room', 'Pool limit per room'], ['edit_cutoff_hours', 'Guest edit cutoff (hours before check-in)'], ['data_retention_days', 'Delete IDs/proofs after check-out (days)'],
];
const TXT: [keyof Settings, string][] = [['checkin_time', 'Check-in time'], ['checkout_time', 'Check-out time'], ['gcash_name', 'GCash name'], ['gcash_number', 'GCash number'], ['owner_email', 'Owner email'], ['owner_mobile', 'Owner mobile (SMS alerts)'], ['airbnb_ical_import_url', 'Airbnb iCal import URL'], ['ical_export_token', 'iCal export token']];

export default function SettingsPage() {
  const { db, act } = useStore();
  const [s, setS] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [pw, setPw] = useState('');
  useEffect(() => { if (db && !s) setS(structuredClone(db.settings)); }, [db, s]);
  if (!db || !s) return <AppShell role="admin"><Loading /></AppShell>;
  const save = () => { act((d, c) => { const before = d.settings; d.settings = s; audit(d, c, 'settings_updated', 'settings', '1', { changed: Object.keys(s).filter((k) => JSON.stringify((before as never)[k]) !== JSON.stringify((s as never)[k])) }); }); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  return <AppShell role="admin">
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Pricing & rules">
        <div className="grid gap-3 sm:grid-cols-2">{NUM.map(([k, l, h]) => <Field key={k} label={l} hint={h}><input type="number" className={inputCls} value={s[k] as number} onChange={(e) => setS({ ...s, [k]: Number(e.target.value) })} /></Field>)}</div>
      </Card>
      <div className="space-y-4">
        <Card title="Business details">
          <div className="grid gap-3 sm:grid-cols-2">{TXT.map(([k, l]) => <Field key={k} label={l}><input className={inputCls} value={s[k] as string} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></Field>)}</div>
          <div className="mt-3"><Field label="GCash QR image"><input type="file" accept="image/*" className="text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const r = await fileToStored(f, 600); setS({ ...s, gcash_qr_path: r.dataUrl }); } }} /></Field>{s.gcash_qr_path && <img src={s.gcash_qr_path} alt="QR" className="mt-2 h-32 rounded border" />}</div>
        </Card>
        <Card title="Check-in / check-out checklists">
          <Field label="Check-in (one per line)"><textarea className={inputCls} rows={5} value={s.checkin_checklist.join('\n')} onChange={(e) => setS({ ...s, checkin_checklist: e.target.value.split('\n').filter(Boolean) })} /></Field>
          <div className="mt-2"><Field label="Check-out (one per line)"><textarea className={inputCls} rows={3} value={s.checkout_checklist.join('\n')} onChange={(e) => setS({ ...s, checkout_checklist: e.target.value.split('\n').filter(Boolean) })} /></Field></div>
        </Card>
        <Card title="Staff account">
          <p className="mb-2 text-sm">staff@demo</p>
          <div className="flex gap-2"><input className={inputCls} type="password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} /><Btn variant="outline" disabled={pw.length < 8} onClick={() => { act((d, c) => audit(d, c, 'staff_password_reset', 'user', 'staff')); setPw(''); alert('Demo: password reset recorded (Supabase Auth admin API in production).'); }}>Reset</Btn></div>
          <p className="mt-1 text-xs text-stone-500">Min 8 characters.</p>
        </Card>
      </div>
    </div>
    <div className="sticky bottom-0 mt-4 flex justify-end gap-2 border-t bg-stone-50 py-3"><span className="self-center text-sm text-emerald-700">{saved && 'Saved ✓'}</span><Btn onClick={save}>Save settings</Btn></div>
  </AppShell>;
}
