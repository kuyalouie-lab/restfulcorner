/**
 * A tiny async mutex. The booking submit path awaits file processing, so two submits
 * can interleave; the availability check + insert runs inside this lock so only one wins.
 * Across browser tabs the Web Locks API is used when available.
 * Production equivalent: Postgres exclusion constraint on daterange (see supabase/schema.sql).
 */
export function createMutex() {
  let tail: Promise<unknown> = Promise.resolve();
  return function run<T>(fn: () => T | Promise<T>): Promise<T> {
    const exec = () => {
      const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
      return locks ? (locks.request('trc-booking', () => fn()) as Promise<T>) : Promise.resolve().then(fn);
    };
    const p = tail.then(exec, exec);
    tail = p.catch(() => undefined);
    return p;
  };
}
