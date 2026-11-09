'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SiteShell } from '@/components/site';
import { Btn, Card, Field, inputCls, useQuery } from '@/components/ui';
import { useStore } from '@/lib/store';

/** Demo auth. Production: Supabase Auth (email + password) with a `role` claim used by RLS. */
const ACCOUNTS: Record<string, { pw: string; role: 'admin' | 'staff' }> = {
  'owner@demo': { pw: 'demo', role: 'admin' },
  'staff@demo': { pw: 'demo', role: 'staff' },
};

export default function Login() {
  const { login } = useStore();
  const router = useRouter();
  const denied = useQuery('denied');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const go = (e: string, p: string) => {
    const a = ACCOUNTS[e.trim().toLowerCase()];
    if (!a || a.pw !== p) return setErr('Wrong email or password.');
    login(a.role);
    router.push(a.role === 'admin' ? '/admin/' : '/staff/');
  };
  return <SiteShell>
    <div className="mx-auto max-w-sm px-4 py-10">
      <Card title="Owner / staff login">
        {denied && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">Please log in with an account that can open that page.</p>}
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); go(email, pw); }}>
          <Field label="Email"><input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></Field>
          <Field label="Password"><input className={inputCls} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></Field>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Btn className="w-full" type="submit">Log in</Btn>
        </form>
        <div className="mt-5 border-t pt-4 text-sm">
          <p className="mb-2 font-semibold">Demo accounts (password: <code>demo</code>)</p>
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="outline" onClick={() => go('owner@demo', 'demo')}>Owner (admin)</Btn>
            <Btn variant="outline" onClick={() => go('staff@demo', 'demo')}>Staff</Btn>
          </div>
        </div>
      </Card>
    </div>
  </SiteShell>;
}
