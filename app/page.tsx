'use client';
import { SiteShell, FB_URL, MESSENGER_URL } from '@/components/site';
import { Card, LinkBtn } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { DEFAULT_SETTINGS } from '@/lib/settings';
import { calculatePrice } from '@/lib/pricing';
import { peso } from '@/lib/dates';

const GALLERY = [
  { en: 'Sala & dining', fil: 'Sala at kainan', c: 'from-amber-200 to-orange-300' },
  { en: 'Master bedroom', fil: 'Master bedroom', c: 'from-sky-200 to-indigo-300' },
  { en: 'Second bedroom', fil: 'Ikalawang kuwarto', c: 'from-emerald-200 to-teal-300' },
  { en: 'Pool', fil: 'Pool', c: 'from-cyan-200 to-blue-400' },
  { en: 'Kitchen', fil: 'Kusina', c: 'from-rose-200 to-pink-300' },
  { en: 'Bathroom', fil: 'Banyo', c: 'from-stone-200 to-stone-400' },
];

export default function Home() {
  const { t, lang } = useT();
  const { db } = useStore();
  const s = db?.settings ?? DEFAULT_SETTINGS;
  const promos = (db?.promos ?? []).filter((p) => p.active).sort((a, b) => a.sort - b.sort);
  const examples = [2, 3, 4, s.max_guests];
  return <SiteShell>
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-500 text-white">
      <svg aria-hidden className="absolute inset-0 h-full w-full opacity-15" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice"><path d="M0 150 Q100 120 200 150 T400 150 V200 H0Z" fill="white" /><rect x="250" y="40" width="90" height="100" rx="6" fill="white" /><rect x="262" y="55" width="25" height="25" fill="#2f6649" /><rect x="302" y="55" width="25" height="25" fill="#2f6649" /><rect x="262" y="95" width="25" height="25" fill="#2f6649" /><rect x="302" y="95" width="25" height="25" fill="#2f6649" /></svg>
      <div className="relative mx-auto max-w-5xl px-4 py-14 sm:py-20">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-emerald-100">2BR · Quezon City · {lang === 'fil' ? 'Libreng pool' : 'Free pool'}</p>
        <h1 className="max-w-xl text-3xl font-extrabold leading-tight sm:text-5xl">{t.hero_title}</h1>
        <p className="mt-3 max-w-lg text-emerald-50">{t.hero_sub}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <LinkBtn href="/book/" className="bg-white !text-brand-700 hover:bg-emerald-50 text-base px-6">{t.book_now}</LinkBtn>
          <LinkBtn href="/availability/" variant="outline" className="border-white !text-white hover:bg-white/10">{t.nav_avail}</LinkBtn>
          <span className="text-sm font-semibold">{t.from_night}</span>
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <section>
        <h2 className="mb-3 text-xl font-bold">{t.gallery}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {GALLERY.map((g) => <div key={g.en} className={`flex aspect-[4/3] items-end rounded-xl bg-gradient-to-br ${g.c} p-2`}><span className="rounded bg-white/80 px-2 py-0.5 text-xs font-semibold">{lang === 'fil' ? g.fil : g.en}</span></div>)}
        </div>
        <p className="mt-1 text-xs text-stone-500">{lang === 'fil' ? 'Demo: papalitan ng tunay na larawan.' : 'Demo placeholders — replace with real photos.'}</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={t.amenities}><ul className="grid grid-cols-1 gap-1 text-sm">{t.am.map((a) => <li key={a}>✓ {a}</li>)}</ul></Card>
        <Card title={t.room_rule_title}>
          <ul className="space-y-2 text-sm"><li className="rounded-lg bg-amber-50 p-2">🔑 {t.room_rule_13}</li><li className="rounded-lg bg-emerald-50 p-2">🏠 {t.room_rule_4}</li><li className="rounded-lg bg-sky-50 p-2">🏊 {t.pool_rule}</li></ul>
        </Card>
      </div>

      <Card title={t.pricing}>
        <p className="mb-3 text-sm text-stone-600">{t.price_note}</p>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b text-left text-stone-500"><th className="py-2"></th><th>{t.per_night}</th><th>{t.one_night_total}</th></tr></thead>
          <tbody>{examples.map((g) => { const p = calculatePrice(s, g, 1); return <tr key={g} className="border-b last:border-0"><td className="py-2 font-medium">{t.guests_n(g)}</td><td>{peso(p.nightly_rate)}</td><td className="font-semibold">{peso(p.total)}</td></tr>; })}</tbody>
        </table></div>
      </Card>

      {promos.length > 0 && <section>
        <h2 className="mb-3 text-xl font-bold">{t.promos}</h2>
        <div className="grid gap-3 sm:grid-cols-2">{promos.map((p) => <Card key={p.id}>{p.image_path && <img src={p.image_path} alt="" className="mb-2 aspect-video w-full rounded-lg object-cover" />}<h3 className="font-semibold">{lang === 'fil' ? p.title_fil : p.title_en}</h3><p className="text-sm text-stone-600">{lang === 'fil' ? p.body_fil : p.body_en}</p></Card>)}</div>
      </section>}

      <Card title={t.location}>
        <p className="text-sm text-stone-600">Quezon City, Metro Manila. {lang === 'fil' ? 'Ibibigay ang eksaktong address sa kumpirmasyon.' : 'Exact address is sent with your confirmation.'}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <LinkBtn variant="outline" href="https://maps.google.com/?q=Quezon+City">{t.directions}</LinkBtn>
          <LinkBtn variant="outline" href={FB_URL}>{t.fb}</LinkBtn>
          <LinkBtn variant="outline" href={MESSENGER_URL}>{t.messenger}</LinkBtn>
        </div>
      </Card>

      <div className="rounded-2xl bg-brand-900 p-6 text-center text-white">
        <p className="mb-3 text-lg font-semibold">{lang === 'fil' ? 'Handa ka na bang mag-relax?' : 'Ready to unwind?'}</p>
        <LinkBtn href="/book/" className="bg-white !text-brand-700 text-base px-8">{t.book_now}</LinkBtn>
      </div>
    </div>
  </SiteShell>;
}
