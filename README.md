# The Restful Corner — Booking System (Demo MVP)

A clickable demo of every phase in `spec.md`. **No database:** all data lives in your browser
(localStorage), seeded with ~12 months of Facebook/direct and Airbnb bookings. Use **Reset demo**
in the owner header to start over.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # pricing, double-booking, hold expiry, penalties, iCal, revenue tests
npm run build        # static export to ./out (deploy anywhere, e.g. Vercel)
```

## Logins (password `demo`)
- **Owner/admin:** `owner@demo` — or tap "Owner (admin)" on `/login`
- **Staff:** `staff@demo`

## Try this
1. `/book` → book 3 guests (you must choose sala/bedroom aircon, name every guest, upload an ID, tick 4 boxes).
2. On the payment page, enter a GCash ref and upload any image.
3. Log in as owner → Dashboard action queue → Verify → Approve (confirmation + invoice are "sent": see **Outbox**).
4. Log in as staff → open the booking → set actual guests to 6 → 3 undeclared × ₱2,500 = ₱7,500 added, owner SMS logged.
5. Print the guest list / invoice, try FIL toggle, Airbnb "Convert to Airbnb booking", calendar blocks, settings.

## What maps to what (demo → production)
| Spec | Demo | Production swap |
|---|---|---|
| Postgres + RLS | `lib/store.tsx` (localStorage) + `lib/engine.ts` | Supabase; `supabase/schema.sql` shows the exclusion constraint + RLS |
| DB-level double-booking guard | atomic check+insert under a mutex / Web Locks (`lib/lock.ts`), tested | `exclude using gist (daterange …)` |
| Supabase Auth roles | demo login + `RoleGate` | Supabase Auth + RLS (staff can't SELECT settings/IDs) |
| Resend / Semaphore | `sendEmail()` / `sendSms()` write to the Outbox (`lib/notify.ts`) | replace bodies with API calls |
| pg_cron jobs | run every 30 s while the app is open + "Run scheduled jobs now" | pg_cron + pg_net → `/api/jobs/*` |
| Airbnb iCal import/export | parse/generate in `lib/ical.ts`; demo feed / paste .ics; download export | server route fetches URL every 30 min; serves `/api/ical/{token}.ics` |
| PDF invoice | printable page → Save as PDF | `@react-pdf/renderer` attachment |
| next-intl | small EN/FIL dictionary (`lib/i18n.tsx`) | next-intl |
| Token hash | token stored plain | store SHA-256 hash only |

## Assumptions (all in `lib/settings.ts`, editable in Admin → Settings)
- `max_guests = 7` (2 + 5 extra) — owner to confirm vs 5 total.
- ₱1,000 is a downpayment deducted from the total; `security_deposit_amount = 0` (off).
- Cancellation policy is placeholder text marked `<!-- OWNER REVIEW -->` in `lib/content.ts`.
- Exactly 4 guests = both rooms + both aircons.

## Not done in the demo
Real IP capture, rate limiting and Turnstile (need a server), real Lighthouse audit, real photos/GCash QR.
