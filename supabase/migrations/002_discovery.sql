-- Auto-discovery support. Safe to run more than once.
-- BEFORE RUNNING: the email below must match ALLOWED_EMAIL.

alter table companies add column if not exists source text default 'manual';
alter table companies add column if not exists discovered_at timestamp;

create table if not exists discovery_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamp default now(),
  trigger text,          -- 'manual' | 'cron'
  added int default 0,
  scanned int default 0,
  details jsonb,
  error text
);

alter table discovery_runs enable row level security;

drop policy if exists "owner only" on discovery_runs;
create policy "owner only" on discovery_runs for all to authenticated
  using ((auth.jwt() ->> 'email') = 'coop1090@outlook.com')
  with check ((auth.jwt() ->> 'email') = 'coop1090@outlook.com');
