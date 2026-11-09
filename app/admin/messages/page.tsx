'use client';
import Link from 'next/link';
import { useState } from 'react';
import { AppShell } from '@/components/shell';
import { Btn, Card, Loading, cx } from '@/components/ui';
import { useStore } from '@/lib/store';
import { fmtDateTime } from '@/lib/dates';
import { runAllJobs } from '@/lib/engine';

/** The demo "Outbox": every email/SMS that sendEmail()/sendSms() would have sent. */
export default function Outbox() {
  const { db, act } = useStore();
  const [filter, setFilter] = useState<'all' | 'email' | 'sms' | 'failed'>('all');
  const [jobMsg, setJobMsg] = useState('');
  if (!db) return <AppShell role="admin"><Loading /></AppShell>;
  const rows = db.message_log.filter((m) => filter === 'all' || (filter === 'failed' ? m.status === 'failed' : m.channel === filter));
  return <AppShell role="admin">
    <Card title="Outbox (email + SMS log)" right={<Btn variant="outline" className="!min-h-[36px] text-xs" onClick={() => { const r = act((d, c) => runAllJobs(d, c), 'system'); setJobMsg(`Jobs ran: ${r.expired} holds expired, ${r.reminders} reminders sent, ${r.purged} files purged.`); }}>Run scheduled jobs now</Btn>}>
      <p className="mb-2 text-xs text-stone-500">Demo: messages are logged here instead of going through Resend / Semaphore. Jobs (hold expiry, 9 AM reminders, 30-day privacy purge) also run automatically every 30 s while the app is open — pg_cron in production.</p>
      {jobMsg && <p className="mb-2 rounded bg-emerald-50 p-2 text-sm">{jobMsg}</p>}
      <div className="mb-3 flex gap-1">{(['all', 'email', 'sms', 'failed'] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={cx('rounded-lg px-3 py-1 text-sm', filter === f ? 'bg-brand-600 text-white' : 'bg-stone-100')}>{f}</button>)}</div>
      <ul className="divide-y">{rows.map((m) => { const b = db.bookings.find((x) => x.id === m.booking_id); return <li key={m.id} className="py-2 text-sm">
        <details><summary className="cursor-pointer"><span className={cx('mr-2 rounded px-1.5 py-0.5 text-xs font-bold', m.channel === 'sms' ? 'bg-violet-100 text-violet-800' : 'bg-blue-100 text-blue-800')}>{m.channel.toUpperCase()}</span>{m.template} → {m.to} <span className="text-xs text-stone-500">· {fmtDateTime(m.sent_at)}</span> <span className={cx('text-xs', m.status === 'failed' ? 'text-red-600' : m.status === 'queued' ? 'text-amber-600' : 'text-emerald-700')}>{m.status}{m.error && `: ${m.error}`}</span>{b && <Link className="ml-2 text-xs text-brand-700 underline" href={`/admin/booking/?id=${b.id}`}>{b.code}</Link>}</summary>
          <pre className="mt-1 whitespace-pre-wrap rounded bg-stone-50 p-2 text-xs">{m.subject ? `Subject: ${m.subject}\n\n` : ''}{m.body}{m.channel === 'sms' ? `\n\n(${m.body.length} chars)` : ''}</pre></details>
      </li>; })}{!rows.length && <li className="py-2 text-sm text-stone-500">Nothing yet.</li>}</ul>
    </Card>
  </AppShell>;
}
