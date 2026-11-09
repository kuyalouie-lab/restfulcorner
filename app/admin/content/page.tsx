'use client';
import { useState } from 'react';
import { AppShell } from '@/components/shell';
import { Btn, Card, Field, Loading, Markdown, cx, inputCls } from '@/components/ui';
import { fileToStored, useStore } from '@/lib/store';
import { audit, rid } from '@/lib/engine';
import type { ContentPage, Promo } from '@/lib/types';

export default function ContentAdmin() {
  const { db, act } = useStore();
  const [slug, setSlug] = useState<ContentPage['slug']>('rules');
  const [lang, setLang] = useState<'en' | 'fil'>('en');
  const [draft, setDraft] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  if (!db) return <AppShell role="admin"><Loading /></AppShell>;
  const page = db.content_pages.find((p) => p.slug === slug)!;
  const body = draft ?? (lang === 'en' ? page.body_en : page.body_fil);
  const savePromo = (p: Promo) => act((d, c) => { const i = d.promos.findIndex((x) => x.id === p.id); if (i >= 0) d.promos[i] = p; else d.promos.push(p); audit(d, c, 'promo_saved', 'promo', p.id); });
  return <AppShell role="admin">
    <Card title="Rules, FAQ & expectations (EN / FIL markdown)">
      <div className="mb-2 flex flex-wrap gap-2">
        {(['rules', 'faq', 'expectations', 'about'] as const).map((s) => <button key={s} onClick={() => { setSlug(s); setDraft(null); }} className={cx('rounded-lg px-3 py-1.5 text-sm', slug === s ? 'bg-brand-600 text-white' : 'bg-stone-100')}>{s}</button>)}
        <span className="mx-2 border-l" />
        {(['en', 'fil'] as const).map((l) => <button key={l} onClick={() => { setLang(l); setDraft(null); }} className={cx('rounded-lg px-3 py-1.5 text-sm', lang === l ? 'bg-stone-800 text-white' : 'bg-stone-100')}>{l.toUpperCase()}</button>)}
        <button className="ml-auto text-sm underline" onClick={() => setPreview(!preview)}>{preview ? 'Edit' : 'Preview'}</button>
      </div>
      {preview ? <div className="rounded-lg border p-3"><Markdown text={body} showReview /></div> : <textarea className={inputCls + ' font-mono text-xs'} rows={18} value={body} onChange={(e) => setDraft(e.target.value)} />}
      <p className="mt-1 text-xs text-stone-500">Items marked <code>&lt;!-- OWNER REVIEW --&gt;</code> are highlighted in preview and hidden from guests.</p>
      <Btn className="mt-2" disabled={draft === null} onClick={() => { act((d, c) => { const p = d.content_pages.find((x) => x.slug === slug)!; if (lang === 'en') p.body_en = draft!; else p.body_fil = draft!; audit(d, c, 'content_updated', 'content_page', slug, { lang }); }); setDraft(null); }}>Save {slug} ({lang.toUpperCase()})</Btn>
    </Card>
    <Card title="Promos & activities" className="mt-4" right={<Btn variant="outline" className="!min-h-[36px]" onClick={() => savePromo({ id: rid(), title_en: 'New promo', title_fil: 'Bagong promo', body_en: '', body_fil: '', image_path: '', active: false, sort: db.promos.length + 1 })}>+ Add</Btn>}>
      <div className="grid gap-3 md:grid-cols-2">{[...db.promos].sort((a, b) => a.sort - b.sort).map((p) => <PromoEditor key={p.id} p={p} onSave={savePromo} onDelete={() => act((d, c) => { d.promos = d.promos.filter((x) => x.id !== p.id); audit(d, c, 'promo_deleted', 'promo', p.id); })} />)}</div>
    </Card>
  </AppShell>;
}

function PromoEditor({ p, onSave, onDelete }: { p: Promo; onSave: (p: Promo) => void; onDelete: () => void }) {
  const [f, setF] = useState(p);
  return <div className="space-y-2 rounded-xl border p-3">
    <div className="grid grid-cols-2 gap-2">
      <Field label="Title EN"><input className={inputCls} value={f.title_en} onChange={(e) => setF({ ...f, title_en: e.target.value })} /></Field>
      <Field label="Title FIL"><input className={inputCls} value={f.title_fil} onChange={(e) => setF({ ...f, title_fil: e.target.value })} /></Field>
      <Field label="Body EN"><textarea className={inputCls} rows={2} value={f.body_en} onChange={(e) => setF({ ...f, body_en: e.target.value })} /></Field>
      <Field label="Body FIL"><textarea className={inputCls} rows={2} value={f.body_fil} onChange={(e) => setF({ ...f, body_fil: e.target.value })} /></Field>
    </div>
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label className="flex items-center gap-1"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Active</label>
      <label className="flex items-center gap-1">Sort <input type="number" className="w-14 rounded border px-1" value={f.sort} onChange={(e) => setF({ ...f, sort: Number(e.target.value) })} /></label>
      <input type="file" accept="image/*" className="text-xs" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setF({ ...f, image_path: (await fileToStored(file, 800)).dataUrl }); }} />
    </div>
    <div className="flex gap-2"><Btn className="!min-h-[36px]" onClick={() => onSave(f)}>Save</Btn><Btn variant="ghost" className="!min-h-[36px] text-red-600" onClick={onDelete}>Delete</Btn></div>
  </div>;
}
