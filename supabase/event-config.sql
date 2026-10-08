-- The events row gets its config back.
--
-- Run this in the Supabase SQL editor. It is additive and safe to re-run.
--
-- public/data/events.json carries a `config` object - the pass types and their
-- per-audience prices, the coupon codes, the UPI ids money is collected at, the
-- QR image. The events table had no column for it, and utils/data/events.ts
-- reads the table FIRST and only falls back to the file when the table is empty
-- or errors. With two rows present the fallback never ran, so every read
-- returned an event with no config at all.
--
-- Nothing failed loudly. The registration form simply had no plates to offer
-- and fell back to one flat price, no coupon could resolve, the UPI list came
-- from a hard-coded default, and the admin statistics and plate-change screens
-- had no plates to name. The config was in the repository the whole time.
--
-- This only adds the column. The values are written separately, per row, so
-- that nothing else about the rows - status above all - is touched on the way
-- past: the file says mahalaya is OPEN and the table says LOCKED, and which of
-- those is right is not a question a migration should answer.

alter table events
  add column if not exists config jsonb not null default '{}'::jsonb;

-- utils/data/event-sync.ts mirrors this field between the file and the row, so
-- an edit made in the admin editor lands in both. Without the column that
-- mirror silently dropped half of what it was given.
comment on column events.config is
  'Pass types and prices, coupons, UPI ids, QR image. Mirrored from public/data/events.json by utils/data/event-sync.ts.';
