-- AI research support. Safe to run more than once.
alter table companies add column if not exists enriched_at timestamp;
