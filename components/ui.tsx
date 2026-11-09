'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Booking, BookingStatus, Settings } from '@/lib/types';
import { addDays, manilaToday } from '@/lib/dates';
import { poolLimit } from '@/lib/pricing';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Btn({ variant = 'primary', className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'outline' }) {
  return <button {...p} className={cx('inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
    variant === 'primary' && 'bg-brand-600 text-white hover:bg-brand-700',
    variant === 'outline' && 'border border-brand-600 text-brand-700 hover:bg-brand-50',
    variant === 'ghost' && 'text-stone-700 hover:bg-stone-100',
    variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700', className)} />;
}
export function LinkBtn({ href, children, className, variant = 'primary' }: { href: string; children: React.ReactNode; className?: string; variant?: 'primary' | 'outline' }) {
  return <Link href={href} className={cx('inline-flex min-h-[44px] items-center justify-center rounded-xl px-5 py-2 text-sm font-semibold', variant === 'primary' ? 'bg-brand-600 text-white hover:bg-brand-700' : 'border border-brand-600 text-brand-700 hover:bg-brand-50', className)}>{children}</Link>;
}
export function Card({ children, className, title, right }: { children: React.ReactNode; className?: string; title?: React.ReactNode; right?: React.ReactNode }) {
  return <section className={cx('rounded-2xl border border-stone-200 bg-white p-4 shadow-sm', className)}>
    {title && <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-semibold text-stone-900">{title}</h2>{right}</div>}
    {children}
  </section>;
}
export function Field({ label, hint, error, children }: { label: React.ReactNode; hint?: React.ReactNode; error?: string | false; children: React.ReactNode }) {
  return <label className="block space-y-1">
    <span className="text-sm font-medium text-stone-800">{label}</span>
    {children}
    {hint && <span className="block text-xs text-stone-500">{hint}</span>}
    {error && <span className="block text-xs font-medium text-red-600">{error}</span>}
  </label>;
}
export const inputCls = 'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100';

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending_payment: 'bg-amber-100 text-amber-800', payment_submitted: 'bg-sky-100 text-sky-800', confirmed: 'bg-emerald-100 text-emerald-800',
  checked_in: 'bg-violet-100 text-violet-800', checked_out: 'bg-stone-200 text-stone-700', expired: 'bg-stone-100 text-stone-500',
  declined: 'bg-red-100 text-red-700', cancelled: 'bg-stone-100 text-stone-500', refund_due: 'bg-rose-100 text-rose-800',
};
export function StatusBadge({ s, label }: { s: BookingStatus; label?: string }) {
  return <span className={cx('inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_COLORS[s])}>{label ?? s.replace(/_/g, ' ')}</span>;
}
export function SourceBadge({ s }: { s: Booking['source'] }) {
  return <span className={cx('inline-block rounded-full px-2 py-0.5 text-xs font-semibold', s === 'airbnb' ? 'bg-rose-100 text-rose-700' : s === 'direct' ? 'bg-blue-100 text-blue-700' : 'bg-stone-100 text-stone-700')}>{s === 'direct' ? 'Facebook/Direct' : s === 'airbnb' ? 'Airbnb' : 'Manual'}</span>;
}

/** Room/aircon allotment, shown everywhere. */
export function Allotment({ b, s, big, lang = 'en' }: { b: Pick<Booking, 'rooms_allowed' | 'aircon_choice'>; s: Settings; big?: boolean; lang?: 'en' | 'fil' }) {
  const ac = b.aircon_choice === 'bedroom' ? (lang === 'fil' ? 'kuwarto' : 'bedroom') : 'sala';
  const main = b.rooms_allowed === 2 ? (lang === 'fil' ? '2 KUWARTO · 2 AIRCON' : '2 ROOMS · 2 AIRCONS') : (lang === 'fil' ? `1 KUWARTO · AIRCON: ${ac.toUpperCase()}` : `1 ROOM · AIRCON: ${ac.toUpperCase()}`);
  return <div className={cx('rounded-xl border-2 px-3 py-2', b.rooms_allowed === 2 ? 'border-emerald-500 bg-emerald-50' : 'border-amber-500 bg-amber-50')}>
    <div className={cx('font-extrabold tracking-wide', big ? 'text-2xl' : 'text-base', b.rooms_allowed === 2 ? 'text-emerald-800' : 'text-amber-800')}>{main}</div>
    <div className="text-xs text-stone-700">{b.rooms_allowed === 1 && (lang === 'fil' ? 'Nakakandado ang ika-2 kuwarto · ' : '2nd room LOCKED · ')}{lang === 'fil' ? 'Limit sa pool' : 'Pool limit'}: {poolLimit(s, b.rooms_allowed)}</div>
  </div>;
}

/** Minimal markdown: headings, lists, tables, bold, links, paragraphs. HTML comments hidden. */
export function Markdown({ text, showReview }: { text: string; showReview?: boolean }) {
  const src = showReview ? text.replace(/<!--\s*(OWNER REVIEW[^>]*?)\s*-->/g, '⚠️[$1]') : text.replace(/<!--[\s\S]*?-->/g, '');
  const inline = (s: string) => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.+?)\]\((https?:[^)]+)\)/g, '<a class="underline text-brand-700" href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/⚠️\[(.+?)\]/g, '<mark class="bg-amber-200 px-1 rounded text-xs">⚠️ $1</mark>');
  const blocks: string[] = [];
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^#{1,3} /.test(l)) { const lv = l.match(/^#+/)![0].length; const cls = lv === 1 ? 'text-2xl font-bold mt-2 mb-3' : lv === 2 ? 'text-lg font-semibold mt-5 mb-2 text-brand-700' : 'font-semibold mt-4 mb-1'; blocks.push(`<h${lv} class="${cls}">${inline(l.replace(/^#+ /, ''))}</h${lv}>`); }
    else if (/^- /.test(l)) { const items: string[] = []; while (i < lines.length && /^- /.test(lines[i])) items.push(`<li>${inline(lines[i++].slice(2))}</li>`); i--; blocks.push(`<ul class="list-disc pl-5 space-y-1">${items.join('')}</ul>`); }
    else if (/^\|/.test(l)) { const rows: string[][] = []; while (i < lines.length && /^\|/.test(lines[i])) { const r = lines[i++].split('|').slice(1, -1).map((c) => c.trim()); if (!r.every((c) => /^-+$/.test(c))) rows.push(r); } i--; blocks.push(`<div class="overflow-x-auto"><table class="my-2 w-full text-sm border">${rows.map((r, ri) => `<tr class="${ri ? '' : 'bg-brand-50 font-semibold'}">${r.map((c) => `<td class="border px-2 py-1">${inline(c)}</td>`).join('')}</tr>`).join('')}</table></div>`); }
    else if (l.trim()) blocks.push(`<p class="my-2">${inline(l)}</p>`);
  }
  return <div className="text-stone-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: blocks.join('') }} />;
}

/** Month calendar grid. `cell(date)` returns content/classes for each day. */
export function MonthGrid({ month, onMonth, render, minMonth }: { month: string; onMonth: (m: string) => void; render: (d: string) => React.ReactNode; minMonth?: string }) {
  const first = month + '-01';
  const [y, m] = month.split('-').map(Number);
  const startDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const shift = (n: number) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); onMonth(d.toISOString().slice(0, 7)); };
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return <div>
    <div className="mb-2 flex items-center justify-between">
      <Btn variant="ghost" onClick={() => shift(-1)} disabled={!!minMonth && month <= minMonth} aria-label="Previous month">‹</Btn>
      <div className="font-semibold">{label}</div>
      <Btn variant="ghost" onClick={() => shift(1)} aria-label="Next month">›</Btn>
    </div>
    <div className="grid grid-cols-7 gap-1 text-center text-xs text-stone-500">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i}>{d}</div>)}</div>
    <div className="mt-1 grid grid-cols-7 gap-1">
      {Array.from({ length: startDow }, (_, i) => <div key={'e' + i} />)}
      {Array.from({ length: days }, (_, i) => <div key={i}>{render(addDays(first, i))}</div>)}
    </div>
  </div>;
}
export const thisMonth = () => manilaToday().slice(0, 7);

export function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const ms = Math.max(0, new Date(to).getTime() - now);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return <span className="font-mono text-2xl font-bold tabular-nums">{h}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}</span>;
}

export function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title?: string }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
      <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">{title}</h3><Btn variant="ghost" onClick={onClose} aria-label="Close">✕</Btn></div>
      {children}
    </div>
  </div>;
}

export function Loading() { return <div className="p-8 text-center text-stone-500">Loading…</div>; }

export function useQuery(name: string) {
  const [v, setV] = useState<string | null | undefined>(undefined);
  useEffect(() => { setV(new URLSearchParams(window.location.search).get(name)); }, [name]);
  return v;
}
