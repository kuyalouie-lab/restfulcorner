-- REFERENCE ONLY (the demo uses no database). Key production guarantees from spec §5 / §11.
create extension if not exists btree_gist;

create table bookings (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  source text not null check (source in ('direct','airbnb','manual')),
  status text not null,
  check_in_date date not null,
  check_out_date date not null check (check_out_date > check_in_date),
  declared_guests int not null check (declared_guests between 1 and 7),
  guest_token_hash text not null,
  -- ...remaining columns as in lib/types.ts
  created_at timestamptz default now()
);

-- Double-booking prevented IN THE DATABASE: no two active bookings may overlap a night.
alter table bookings add constraint no_overlap exclude using gist (
  daterange(check_in_date, check_out_date, '[)') with &&
) where (status in ('pending_payment','payment_submitted','confirmed','checked_in'));

-- RLS: guests never query directly (server routes check code + token hash).
alter table bookings enable row level security;
create policy admin_all on bookings for all using ((auth.jwt() ->> 'role') = 'admin');
create policy staff_read on bookings for select using ((auth.jwt() ->> 'role') = 'staff');
-- guest_ids: admin only. settings / sales views: admin only. Storage buckets 'ids' and 'proofs' private.

-- pg_cron + pg_net (every 5 min holds/reminders, every 30 min Airbnb sync, daily purge):
-- select cron.schedule('airbnb-sync','*/30 * * * *',
--   $$select net.http_post(url:='https://YOUR_APP/api/jobs/airbnb-sync', headers:='{"x-cron-secret":"..."}'::jsonb)$$);
