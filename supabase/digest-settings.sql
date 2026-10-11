-- Whether the daily manager digest goes out, switchable from /admin/digests.
--
-- Run this in the Supabase SQL editor. Additive and safe to re-run.
--
-- Between events there is nothing to verify and nothing to tell managers, so
-- the super admin can pause the cron's emails instead of every manager getting
-- a quiet inbox or the cron being taken out of vercel.json. Without this table
-- the digest simply keeps running as it always has.

create table if not exists digest_settings (
  -- Single-row table: the id is pinned so an upsert always targets one row.
  id boolean primary key default true,
  constraint digest_settings_singleton check (id),

  is_paused boolean not null default false,
  updated_at timestamptz default now(),
  updated_by text
);

-- Same posture as the other tables: denied to anon, reached only through the
-- service-role client in the API routes.
alter table digest_settings enable row level security;

grant all on table digest_settings to service_role;
