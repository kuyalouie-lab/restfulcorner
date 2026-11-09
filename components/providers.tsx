'use client';
import { I18nProvider } from '@/lib/i18n';
import { StoreProvider } from '@/lib/store';
export function Providers({ children }: { children: React.ReactNode }) {
  return <I18nProvider><StoreProvider>{children}</StoreProvider></I18nProvider>;
}
