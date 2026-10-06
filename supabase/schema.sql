-- Biotech Watchlist schema. Run once in Supabase → SQL Editor.
-- Locked to coop1090@outlook.com. If you change ALLOWED_EMAIL, change it here too.

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ticker_or_private text,
  modality text,
  lead_program text,
  stage text,
  nct_id text,
  next_catalyst text,
  catalyst_date date,
  last_financing_amount text,
  last_financing_date date,
  lead_investor text,
  cash_runway_months int,
  runway_as_of date,
  score int check (score between 0 and 10),
  rubric jsonb,           -- per-category 0–2 scores behind `score` (added so edits can re-score)
  tier int check (tier in (1,2,3)),
  thesis_fit boolean,
  key_risk text,
  source_links jsonb default '[]'::jsonb,
  decision text check (decision in ('Buy','Watch','Pass')),
  notes text,
  last_reviewed date,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists thesis (
  id int primary key default 1 check (id = 1),
  modalities text,
  stage_preference text,
  risk_tolerance text,
  geography text,
  exclusions text,
  time_horizon text,
  updated_at timestamp default now()
);

insert into thesis (id) values (1) on conflict (id) do nothing;

-- Keep updated_at fresh
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists companies_updated_at on companies;
create trigger companies_updated_at before update on companies
  for each row execute function set_updated_at();

drop trigger if exists thesis_updated_at on thesis;
create trigger thesis_updated_at before update on thesis
  for each row execute function set_updated_at();

create index if not exists companies_catalyst_date_idx on companies (catalyst_date);
create index if not exists companies_tier_idx on companies (tier);

-- If you created the table before the rubric column existed:
alter table companies add column if not exists rubric jsonb;

-- Row Level Security: only the owner email can read or write anything.
alter table companies enable row level security;
alter table thesis enable row level security;

drop policy if exists "owner only" on companies;
create policy "owner only" on companies for all to authenticated
  using ((auth.jwt() ->> 'email') = 'coop1090@outlook.com')
  with check ((auth.jwt() ->> 'email') = 'coop1090@outlook.com');

drop policy if exists "owner only" on thesis;
create policy "owner only" on thesis for all to authenticated
  using ((auth.jwt() ->> 'email') = 'coop1090@outlook.com')
  with check ((auth.jwt() ->> 'email') = 'coop1090@outlook.com');
