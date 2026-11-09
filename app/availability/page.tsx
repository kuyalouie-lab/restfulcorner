'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SiteShell } from '@/components/site';
import { Card, Loading, MonthGrid, cx, thisMonth } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { manilaToday } from '@/lib/dates';
import { nightOccupant } from '@/lib/engine';

export default function Availability() {
  const { t } = useT();
  const { db } = useStore();
  const router = useRouter();
  const [month, setMonth] = useState(thisMonth());
  const today = manilaToday();
  return <SiteShell>
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">{t.avail_title}</h1>
      <p className="text-sm text-stone-600">{t.avail_hint}</p>
      <Card>
        {!db ? <Loading /> : <MonthGrid month={month} onMonth={setMonth} minMonth={thisMonth()} render={(d) => {
          const past = d < today;
          const booked = !past && !!nightOccupant(db, d);
          return <button disabled={past || booked} onClick={() => router.push(`/book/?ci=${d}`)}
            className={cx('aspect-square w-full rounded-lg text-sm font-medium', past ? 'text-stone-300' : booked ? 'bg-stone-200 text-stone-400 line-through' : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200')}
            aria-label={`${d} ${past ? '' : booked ? t.booked : t.available}`}>{Number(d.slice(8))}</button>;
        }} />}
        <div className="mt-3 flex gap-4 text-xs"><span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-emerald-100" />{t.available}</span><span className="flex items-center gap-1"><i className="h-3 w-3 rounded bg-stone-200" />{t.booked}</span></div>
      </Card>
    </div>
  </SiteShell>;
}
