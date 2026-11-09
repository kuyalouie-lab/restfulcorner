'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useT } from '@/lib/i18n';
import { cx } from './ui';

export const FB_URL = 'https://www.facebook.com/therestfulcorner';
export const MESSENGER_URL = 'https://m.me/therestfulcorner';

export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useT();
  return <div className={cx('inline-flex rounded-full border border-stone-300 bg-white p-0.5 text-xs font-semibold', className)} role="group" aria-label="Language">
    {(['en', 'fil'] as const).map((l) => <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={cx('rounded-full px-3 py-1.5', lang === l ? 'bg-brand-600 text-white' : 'text-stone-600')}>{l === 'en' ? 'EN' : 'FIL'}</button>)}
  </div>;
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return <div className="flex min-h-screen flex-col">
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-sand/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2">
        <Link href="/" className="flex items-center gap-2 font-bold text-brand-900">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm text-white">RC</span>
          <span className="hidden sm:inline">The Restful Corner</span>
        </Link>
        <nav className="hidden items-center gap-4 text-sm md:flex">
          <Link href="/availability/">{t.nav_avail}</Link><Link href="/rules/">{t.nav_rules}</Link><Link href="/faq/">{t.nav_faq}</Link>
        </nav>
        <div className="flex items-center gap-2">
          <LangToggle />
          <Link href="/book/" className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white">{t.book_now}</Link>
          <button className="rounded-lg p-2 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
        </div>
      </div>
      {open && <nav className="flex flex-col border-t border-stone-200 px-4 py-2 text-sm md:hidden">
        {[['/', t.nav_home], ['/availability/', t.nav_avail], ['/rules/', t.nav_rules], ['/faq/', t.nav_faq]].map(([h, l]) => <Link key={h} href={h} className="py-2" onClick={() => setOpen(false)}>{l}</Link>)}
      </nav>}
    </header>
    <main className="flex-1">{children}</main>
    <footer className="border-t border-stone-200 bg-white py-6 text-center text-xs text-stone-500">
      <div>{t.footer}</div>
      <div className="mt-2 flex justify-center gap-4"><a href={FB_URL} target="_blank" rel="noreferrer" className="underline">{t.fb}</a><a href={MESSENGER_URL} target="_blank" rel="noreferrer" className="underline">{t.messenger}</a><Link href="/login/" className="underline">Owner / staff login</Link></div>
    </footer>
  </div>;
}
