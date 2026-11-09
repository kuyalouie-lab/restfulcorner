'use client';
/**
 * Demo data layer: the whole "database" lives in localStorage (no backend).
 * Every mutation: re-read latest → run engine fn → save. Swap for Supabase server routes in production.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { DB, Role } from './types';
import { DB_VERSION, seedDB } from './seed';
import { runAllJobs } from './engine';
import type { Ctx } from './notify';
import { createMutex } from './lock';

const KEY = 'trc-db-v' + DB_VERSION;
const ROLE_KEY = 'trc-role';

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DB;
  } catch {}
  const db = seedDB();
  save(db);
  return db;
}
function save(db: DB) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { throw new Error('Browser storage is full. Use "Reset demo data" in the admin menu. (' + (e as Error).message + ')'); }
}

type Act = <T>(fn: (db: DB, ctx: Ctx) => T, actor?: string) => T;
interface Store { db: DB | null; act: Act; role: Role | null; login: (r: Role) => void; logout: () => void; reset: () => void; locked: <T>(fn: () => T | Promise<T>) => Promise<T> }
const StoreCtx = createContext<Store | null>(null);

export function baseUrl() {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const mutex = useRef(createMutex());

  const act: Act = useCallback((fn, actor) => {
    const fresh = load();
    const r = (typeof localStorage !== 'undefined' && (localStorage.getItem(ROLE_KEY) as Role | null)) || 'guest';
    const res = fn(fresh, { now: new Date(), actor: actor ?? r, baseUrl: baseUrl() });
    save(fresh);
    setDb(fresh);
    return res;
  }, []);

  useEffect(() => {
    setDb(load());
    try { setRole(localStorage.getItem(ROLE_KEY) as Role | null); } catch {}
    const jobs = () => { try { act((d, c) => runAllJobs(d, c), 'system'); } catch {} };
    jobs();
    const iv = setInterval(jobs, 30_000); // stands in for pg_cron
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setDb(load()); };
    window.addEventListener('storage', onStorage);
    return () => { clearInterval(iv); window.removeEventListener('storage', onStorage); };
  }, [act]);

  const login = (r: Role) => { localStorage.setItem(ROLE_KEY, r); setRole(r); };
  const logout = () => { localStorage.removeItem(ROLE_KEY); setRole(null); };
  const reset = () => { localStorage.removeItem(KEY); setDb(load()); };
  return <StoreCtx.Provider value={{ db, act, role, login, logout, reset, locked: mutex.current }}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const s = useContext(StoreCtx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}

/** Downscale images before storing (localStorage is ~5 MB). PDFs/HEIC are stored as a placeholder name only. */
export async function fileToStored(file: File, maxPx = 1100): Promise<{ name: string; dataUrl: string }> {
  if (file.size > 10 * 1024 * 1024) throw new Error('file_too_big');
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
    const label = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120"><rect width="300" height="120" fill="#eee"/><text x="150" y="65" text-anchor="middle" font-family="sans-serif" font-size="14">${file.name.replace(/[<&>]/g, '')} (stored)</text></svg>`);
    return { name: file.name, dataUrl: 'data:image/svg+xml;utf8,' + label };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return { name: file.name, dataUrl: c.toDataURL('image/jpeg', 0.7) };
  } finally { URL.revokeObjectURL(url); }
}
