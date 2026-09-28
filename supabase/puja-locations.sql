-- The pujas shown on the Durga Puja map.
--
-- Run this in the Supabase SQL editor, then seed it once from the JSON the
-- map used to read:
--
--   node scripts/seed-puja-locations.js
--
-- It is additive and safe to re-run.
--
-- These live in the database rather than in public/data/*.json because a
-- super admin edits them from the admin site, and Vercel's filesystem is
-- read-only - a write to the JSON there silently does nothing. The database
-- is the only place an edit made in production can actually land, so it is
-- the single source of truth for this list and the JSON is retired to
-- others/ once the seed has run.

create table if not exists puja_locations (
  id uuid primary key default gen_random_uuid(),
  -- What the pin is called on the map.
  name text not null,
  -- The one-line address shown under the name.
  address text not null,
  -- Exactly what Google Maps gives for the spot. Stored as double precision
  -- rather than numeric: these are coordinates, not money, and the map wants
  -- floats anyway.
  lat double precision not null,
  lng double precision not null,
  -- 'active' pins are drawn; anything else is kept but not shown, so a puja
  -- that skips a year need not be deleted and re-entered.
  status text not null default 'active',
  -- Display order on the list beside the map. Ties fall back to name.
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Which admin last touched it, for an audit trail.
  updated_by text
);

-- Coordinates that are not on Earth are a typo, and a typo here puts a pin in
-- the sea with no obvious way to notice. Rejecting them at the column is the
-- one check that cannot be forgotten by a caller.
alter table puja_locations
  drop constraint if exists puja_locations_lat_range;
alter table puja_locations
  add constraint puja_locations_lat_range check (lat >= -90 and lat <= 90);

alter table puja_locations
  drop constraint if exists puja_locations_lng_range;
alter table puja_locations
  add constraint puja_locations_lng_range check (lng >= -180 and lng <= 180);

-- Two pins with the same name at the same spot are a double entry, not two
-- pujas. Name alone is not unique enough - branches of the same samiti share
-- one - so the pair is what has to be distinct.
create unique index if not exists puja_locations_name_spot_idx
  on puja_locations (lower(name), round(lat::numeric, 6), round(lng::numeric, 6));

create index if not exists puja_locations_status_idx on puja_locations (status);

-- Same posture as the other tables: denied to anon, reached only through the
-- service-role client in the API routes.
alter table puja_locations enable row level security;

grant all on table puja_locations to service_role;
