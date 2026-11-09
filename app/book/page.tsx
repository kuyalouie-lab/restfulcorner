'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SiteShell } from '@/components/site';
import { Btn, Card, Field, Loading, Markdown, Modal, cx, inputCls, useQuery } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { fileToStored, useStore } from '@/lib/store';
import { addDays, diffDays, fmtDate, manilaToday, peso } from '@/lib/dates';
import { calculatePrice } from '@/lib/pricing';
import { BookingError, createBooking, isRangeFree, validateBookingInput, type BookingInput } from '@/lib/engine';
import type { Aircon } from '@/lib/types';

const STEP_ERRORS: string[][] = [
  ['dates_required', 'date_past', 'min_one_night', 'dates_taken'],
  ['guest_count', 'infants', 'aircon_required'],
  [],
  ['booker_name', 'mobile', 'email', 'guest_names'],
  ['id_required'],
  ['special_requests'],
  ['agreements'],
];

export default function Book() {
  const { t, lang } = useT();
  const { db, act, locked } = useStore();
  const router = useRouter();
  const qci = useQuery('ci');
  const [step, setStep] = useState(0);
  const [ci, setCi] = useState('');
  const [co, setCo] = useState('');
  const [guests, setGuests] = useState(2);
  const [infants, setInfants] = useState(0);
  const [aircon, setAircon] = useState<Aircon | null>(null);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [names, setNames] = useState<string[]>(['']);
  const [infantNames, setInfantNames] = useState<string[]>([]);
  const [idFile, setIdFile] = useState<{ name: string; dataUrl: string } | null>(null);
  const [requests, setRequests] = useState('');
  const [ag, setAg] = useState({ rules: false, penalty: false, exp: false, privacy: false });
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  useEffect(() => { if (qci) { setCi(qci); setCo(addDays(qci, 1)); } }, [qci]);
  // keep guest-name fields equal to the declared count; booker is guest 1
  useEffect(() => { setNames((n) => Array.from({ length: guests }, (_, i) => n[i] ?? '')); }, [guests]);
  useEffect(() => { setNames((n) => [name, ...n.slice(1)]); }, [name]);
  useEffect(() => { setInfantNames((n) => Array.from({ length: infants }, (_, i) => n[i] ?? '')); }, [infants]);

  if (!db) return <SiteShell><Loading /></SiteShell>;
  const s = db.settings;
  const today = manilaToday();
  const nights = ci && co ? diffDays(ci, co) : 0;
  const price = nights > 0 && guests >= 1 && guests <= s.max_guests ? calculatePrice(s, guests, nights) : null;
  const input: BookingInput = {
    check_in_date: ci, check_out_date: co, declared_guests: guests, infants, aircon_choice: guests >= 4 ? 'both' : aircon,
    booker_name: name, booker_mobile: mobile, booker_email: email, guest_names: names, infant_names: infantNames, id_file: idFile,
    special_requests: requests, language: lang, agree_rules: ag.rules, agree_penalty: ag.penalty, agree_expectations: ag.exp, agree_privacy: ag.privacy, honeypot,
    ip: 'demo-browser (server records real IP)',
  };
  const stepErrors = (i: number) => {
    const all = validateBookingInput(db, input, new Date());
    if (i === 0 && ci && co && nights > 0 && !isRangeFree(db, ci, co)) all.push('dates_taken');
    return all.filter((e) => STEP_ERRORS[i].includes(e));
  };
  const next = () => { const e = stepErrors(step); setErrors(e); if (!e.length) { setStep(step + 1); window.scrollTo({ top: 0 }); } };
  const err = (k: string) => errors.includes(k) && t.err[k];
  const expText = db.content_pages.find((p) => p.slug === 'expectations')!;

  const submit = async () => {
    const e = validateBookingInput(db, input, new Date());
    setErrors(e);
    if (e.length) { const first = STEP_ERRORS.findIndex((se) => se.some((x) => e.includes(x))); if (first >= 0 && first !== step) setStep(first); return; }
    setBusy(true);
    try {
      const b = await locked(() => act((d, c) => createBooking(d, c, input), 'guest'));
      router.push(`/b/?code=${b.code}&t=${b.guest_token}`);
    } catch (x) {
      const codes = x instanceof BookingError ? x.message.split(',') : ['spam'];
      setErrors(codes);
      if (codes.includes('dates_taken')) setStep(0);
      setBusy(false);
    }
  };

  const titles = [t.s_dates, t.s_guests, t.s_price, t.s_details, t.s_id, t.s_requests, t.s_agree];
  const counter = (v: number, set: (n: number) => void, min: number, max: number, label: string) => <div className="flex items-center gap-3">
    <Btn variant="outline" type="button" onClick={() => set(Math.max(min, v - 1))} disabled={v <= min} aria-label={`- ${label}`} className="w-12 text-xl">−</Btn>
    <span className="w-10 text-center text-2xl font-bold tabular-nums">{v}</span>
    <Btn variant="outline" type="button" onClick={() => set(Math.min(max, v + 1))} disabled={v >= max} aria-label={`+ ${label}`} className="w-12 text-xl">+</Btn>
  </div>;
  const PriceBox = price && <div className="space-y-1 rounded-xl bg-brand-50 p-3 text-sm">
    <Row l={`${t.nightly} (${peso(price.nightly_rate)} × ${nights} ${nights > 1 ? t.nights : t.night})`} r={peso(price.room_subtotal)} />
    <Row l={t.cleaning} r={peso(price.cleaning_fee)} />
    <Row l={<b>{t.total}</b>} r={<b>{peso(price.total)}</b>} />
    <div className="my-1 border-t border-brand-100" />
    <Row l={t.dp_now} r={<b className="text-brand-700">{peso(price.downpayment)}</b>} />
    <Row l={t.bal_checkin} r={peso(price.balance_at_checkin)} />
  </div>;

  return <SiteShell>
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div>
        <div className="text-xs font-semibold uppercase text-brand-600">{t.step} {step + 1} {t.of} 7</div>
        <h1 className="text-2xl font-bold">{titles[step]}</h1>
        <div className="mt-2 flex gap-1">{titles.map((_, i) => <div key={i} className={cx('h-1.5 flex-1 rounded-full', i <= step ? 'bg-brand-600' : 'bg-stone-200')} />)}</div>
      </div>
      <Card>
        {/* honeypot (hidden from humans) */}
        <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} name="website" className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />
        {step === 0 && <div className="space-y-4">
          <Field label={t.check_in} error={err('dates_required') || err('date_past')}><input type="date" className={inputCls} min={today} value={ci} onChange={(e) => { setCi(e.target.value); if (!co || co <= e.target.value) setCo(addDays(e.target.value, 1)); }} /></Field>
          <Field label={t.check_out} error={err('min_one_night')}><input type="date" className={inputCls} min={ci ? addDays(ci, 1) : today} value={co} onChange={(e) => setCo(e.target.value)} /></Field>
          {nights > 0 && <p className="text-sm font-medium">{nights} {nights > 1 ? t.nights : t.night} · {fmtDate(ci, lang)} → {fmtDate(co, lang)}</p>}
          {(errors.includes('dates_taken') || (nights > 0 && !isRangeFree(db, ci, co))) && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{t.dates_taken}</p>}
        </div>}
        {step === 1 && <div className="space-y-5">
          <Field label={t.counted_guests} hint={`1–${s.max_guests}`} error={err('guest_count')}>{counter(guests, setGuests, 1, s.max_guests, t.counted_guests)}</Field>
          <Field label={t.infants}>{counter(infants, setInfants, 0, 4, t.infants)}</Field>
          {guests <= 3 ? <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t.aircon_choice}</legend>
            <p className="rounded-lg bg-amber-50 p-2 text-sm font-medium text-amber-900">🔑 {t.aircon_note}</p>
            <div className="grid grid-cols-2 gap-2">{(['sala', 'bedroom'] as const).map((a) => <button type="button" key={a} onClick={() => setAircon(a)} className={cx('rounded-xl border-2 p-3 text-sm font-semibold', aircon === a ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-stone-200')}>{a === 'sala' ? t.aircon_sala : t.aircon_bedroom}</button>)}</div>
            {err('aircon_required') && <p className="text-xs font-medium text-red-600">{t.err.aircon_required}</p>}
          </fieldset> : <p className="rounded-lg bg-emerald-50 p-2 text-sm font-medium text-emerald-900">🏠 {t.both_rooms}</p>}
          {PriceBox}
        </div>}
        {step === 2 && <div className="space-y-3">{PriceBox}<p className="text-xs text-stone-500">{t.pool_rule}</p></div>}
        {step === 3 && <div className="space-y-4">
          <Field label={t.booker_name} error={err('booker_name')}><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
          <Field label={t.mobile} hint="09xxxxxxxxx" error={err('mobile')}><input className={inputCls} inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="0917 123 4567" autoComplete="tel" /></Field>
          <Field label={t.email} error={err('email')}><input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
          <div className="space-y-2 rounded-xl bg-stone-50 p-3">
            <p className="text-sm font-semibold">{t.guest_list} ({guests})</p>
            <p className="text-xs text-stone-500">{t.guest_name_hint}</p>
            {names.map((n, i) => <Field key={i} label={t.guest_name(i + 1)}><input className={inputCls} value={n} readOnly={i === 0} onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} /></Field>)}
            {infantNames.map((n, i) => <Field key={'i' + i} label={t.infant_name(i + 1)}><input className={inputCls} value={n} onChange={(e) => setInfantNames(infantNames.map((x, j) => (j === i ? e.target.value : x)))} /></Field>)}
            {err('guest_names') && <p className="text-xs font-medium text-red-600">{t.err.guest_names}</p>}
          </div>
        </div>}
        {step === 4 && <div className="space-y-3">
          <Field label={t.id_upload} hint={t.id_hint} error={err('id_required') || err('file_too_big')}>
            <input type="file" accept="image/jpeg,image/png,image/heic,image/heif,application/pdf" className="block w-full text-sm" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              try { setIdFile(await fileToStored(f)); setErrors([]); } catch { setErrors(['file_too_big']); }
            }} />
          </Field>
          {idFile && <img src={idFile.dataUrl} alt="ID preview" className="max-h-48 rounded-lg border" />}
        </div>}
        {step === 5 && <Field label={t.requests_label} hint={t.requests_hint} error={err('special_requests')}><textarea className={inputCls} rows={4} value={requests} onChange={(e) => setRequests(e.target.value)} /></Field>}
        {step === 6 && <div className="space-y-3 text-sm">
          <Check v={ag.rules} on={(v) => setAg({ ...ag, rules: v })}>{t.agree_rules} <button type="button" className="font-semibold text-brand-700 underline" onClick={() => setRulesOpen(true)}>{t.read_rules}</button></Check>
          <Check v={ag.penalty} on={(v) => setAg({ ...ag, penalty: v })}><b>{t.agree_penalty(peso(s.undeclared_penalty + s.extra_guest_fee))}</b></Check>
          <Check v={ag.exp} on={(v) => setAg({ ...ag, exp: v })}>{t.agree_exp}<i>{lang === 'fil' ? expText.body_fil : expText.body_en}</i></Check>
          <Check v={ag.privacy} on={(v) => setAg({ ...ag, privacy: v })}>{t.agree_privacy}</Check>
          {err('agreements') && <p className="text-xs font-medium text-red-600">{t.err.agreements}</p>}
          {PriceBox}
          {errors.filter((e) => !STEP_ERRORS[6].includes(e)).length > 0 && <p className="rounded-lg bg-red-50 p-2 text-red-700">{errors.map((e) => t.err[e] ?? e).join(' ')}</p>}
        </div>}
      </Card>
      <div className="flex justify-between gap-2">
        <Btn variant="ghost" onClick={() => { setErrors([]); setStep(step - 1); }} disabled={step === 0}>‹ {t.back}</Btn>
        {step < 6 ? <Btn onClick={next}>{t.next} ›</Btn> : <Btn onClick={submit} disabled={busy}>{busy ? '…' : t.submit}</Btn>}
      </div>
    </div>
    <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title={t.nav_rules}>
      <Markdown text={(lang === 'fil' ? db.content_pages.find((p) => p.slug === 'rules')?.body_fil : db.content_pages.find((p) => p.slug === 'rules')?.body_en) ?? ''} />
      <Btn className="mt-3 w-full" onClick={() => { setAg({ ...ag, rules: true }); setRulesOpen(false); }}>{t.close}</Btn>
    </Modal>
  </SiteShell>;
}

function Row({ l, r }: { l: React.ReactNode; r: React.ReactNode }) { return <div className="flex justify-between gap-3"><span>{l}</span><span className="tabular-nums">{r}</span></div>; }
function Check({ v, on, children }: { v: boolean; on: (v: boolean) => void; children: React.ReactNode }) {
  return <label className={cx('flex gap-3 rounded-xl border p-3', v ? 'border-brand-500 bg-brand-50' : 'border-stone-200')}><input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-brand-600" checked={v} onChange={(e) => on(e.target.checked)} /><span>{children}</span></label>;
}
