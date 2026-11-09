'use client';
import { SiteShell } from '@/components/site';
import { Card, Loading, Markdown } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import type { ContentPage } from '@/lib/types';

export function ContentView({ slug }: { slug: ContentPage['slug'] }) {
  const { lang } = useT();
  const { db } = useStore();
  const page = db?.content_pages.find((p) => p.slug === slug);
  return <SiteShell><div className="mx-auto max-w-3xl px-4 py-6"><Card>{page ? <Markdown text={lang === 'fil' ? page.body_fil : page.body_en} /> : <Loading />}</Card></div></SiteShell>;
}
