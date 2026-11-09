'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import type { Role } from '@/lib/types';
import { Loading, cx } from './ui';

/**
 * Role gate. Demo note: in production this is enforced by Supabase Auth + RLS on every table and
 * private storage buckets — staff simply cannot SELECT settings, sales or ID images. Here the
 * client-side data layer hides them (see `staffSafe` usage on staff pages).
 */
export function RoleGate({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const { role, db } = useStore();
  const router = useRouter();
  const ready = db !== null;
  useEffect(() => { if (ready && (!role || !allow.includes(role))) router.replace('/login/?denied=1'); }, [ready, role, allow, router]);
  if (!ready || !role || !allow.includes(role)) return <Loading />;
  return <>{children}</>;
}

const ADMIN_NAV = [['/admin/', 'Dashboard'], ['/admin/bookings/', 'Bookings'], ['/admin/calendar/', 'Calendar'], ['/admin/airbnb/', 'Airbnb sync'], ['/admin/messages/', 'Outbox'], ['/admin/content/', 'Content & promos'], ['/admin/settings/', 'Settings'], ['/staff/', 'Staff view']];
const STAFF_NAV = [['/staff/', 'Today'], ['/staff/upcoming/', 'Upcoming']];

export function AppShell({ role, children }: { role: Role; children: React.ReactNode }) {
  const path = usePathname();
  const { logout, reset, role: current } = useStore();
  const router = useRouter();
  const nav = role === 'admin' ? ADMIN_NAV : current === 'admin' ? [...STAFF_NAV, ['/admin/', '← Admin']] : STAFF_NAV;
  return <RoleGate allow={role === 'admin' ? ['admin'] : ['admin', 'staff']}>
    <div className="min-h-screen bg-stone-50">
      <header className="no-print sticky top-0 z-40 border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
          <Link href={role === 'admin' ? '/admin/' : '/staff/'} className="flex items-center gap-2 font-bold"><span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-xs text-white">RC</span>{role === 'admin' ? 'Owner' : 'Staff'}</Link>
          <div className="flex items-center gap-1 text-xs">
            <span className="hidden rounded-full bg-stone-100 px-2 py-1 sm:inline">{current === 'admin' ? 'owner@demo' : 'staff@demo'}</span>
            {current === 'admin' && <button className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100" onClick={() => { if (confirm('Reset all demo data to the seed?')) reset(); }}>Reset demo</button>}
            <button className="rounded px-2 py-1 hover:bg-stone-100" onClick={() => { logout(); router.push('/login/'); }}>Log out</button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2 text-sm">
          {nav.map(([h, l]) => <Link key={h} href={h} className={cx('whitespace-nowrap rounded-lg px-3 py-1.5', path === h || (h !== '/admin/' && h !== '/staff/' && path?.startsWith(h)) ? 'bg-brand-600 text-white' : 'text-stone-600 hover:bg-stone-100')}>{l}</Link>)}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
    </div>
  </RoleGate>;
}
