-- One-time codes proving a registrant can read the address they gave.
--
-- Registration previously took the email, the roll number and the "I am from
-- IIIT" flag entirely on trust, and that flag halves the ticket price. A code
-- that has to come back from the mailbox is the only check that tells a real
-- address from an invented one - an MX lookup cannot, because iiit.ac.in has
-- valid MX records and every forged address at that domain passes it.
--
-- Rows are short lived. Nothing here is worth keeping once it has been used or
-- has expired, and the cleanup below is safe to run on a schedule.

create table if not exists email_verifications (
  id uuid primary key default gen_random_uuid(),
  -- Always stored normalised (trimmed, lower case).
  email text not null,
  -- sha256 of "<email>:<code>". The code itself is never stored.
  code_hash text not null,
  expires_at timestamptz not null,
  -- Guesses made against this code. The row dies at five.
  attempts integer not null default 0,
  -- Set when the code is accepted, so one code cannot be spent twice.
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

-- The lookup is always "the newest live code for this address".
create index if not exists email_verifications_email_idx
  on email_verifications (lower(email), created_at desc);

create index if not exists email_verifications_expiry_idx
  on email_verifications (expires_at);

alter table email_verifications enable row level security;

-- No policy is added on purpose: with RLS on and no policy, anon and
-- authenticated can read nothing. Only the service-role client, which bypasses
-- RLS, touches this table - these rows are the one thing standing between a
-- stranger and a student-priced pass.
grant all on table email_verifications to service_role;

-- Housekeeping. Expired and spent rows carry no meaning.
delete from email_verifications
where expires_at < now() - interval '1 day';
-- An address for each manager, so the digest has somewhere to go.
--
-- Separate from the username they sign in with: a username is a handle chosen
-- for a login form, and mail needs a mailbox. Unique, because two profiles
-- sharing an address would send one person two half-pictures of the takings
-- and give neither of them a complete one.

alter table manager_profiles
  add column if not exists email text,
  -- When the last digest went out, so a run only reports what has happened
  -- since and a retry cannot send the same summary twice.
  add column if not exists digest_sent_at timestamptz;

create unique index if not exists manager_profiles_email_idx
  on manager_profiles (lower(email))
  where email is not null;
-- Manager profiles, and the receiver UPI id that routes a payment to one.
--
-- Run this in the Supabase SQL editor before deploying the manager feature.
-- It is additive and safe to re-run.
--
-- Managers get their own table rather than rows in admin_profiles, because
-- admin_profiles.id is a foreign key onto auth.users and these accounts are
-- created by a super admin rather than through Supabase auth.

create table if not exists manager_profiles (
  id uuid primary key default gen_random_uuid(),
  -- What the manager types into the sign-in form.
  username text unique not null,
  -- scrypt, stored as "scrypt$<N>$<r>$<p>$<salt-hex>$<hash-hex>". Never a
  -- plaintext or reversible value.
  password_hash text not null,
  -- Payments made to this UPI id are the only ones this manager can see.
  upi_id text not null,
  name text,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  -- Which admin created the profile, for an audit trail.
  created_by text
);

-- The UPI id has to be unique, not merely indexed. It is what routes a payment
-- to the manager who collected it: tickets carry receiver_upi, and the scope
-- in utils/auth/payment-scope.ts matches on it. Two managers sharing an id
-- would each be able to read and approve the other's payments, and no query
-- could say whose money it was. The application refuses a duplicate before it
-- inserts; this is what settles two insertions racing each other.
drop index if exists manager_profiles_upi_idx;
create unique index if not exists manager_profiles_upi_idx on manager_profiles (lower(upi_id));
create unique index if not exists manager_profiles_username_idx on manager_profiles (lower(username));

-- Where the money actually went, read off the receipt at registration time.
-- Managers are shown the payments whose receiver matches their own UPI id.
alter table tickets
  add column if not exists receiver_upi text;

create index if not exists tickets_receiver_upi_idx on tickets (lower(receiver_upi));

-- Same posture as the other tables: deny to anon, reached only through the
-- service-role client in the API routes.
alter table manager_profiles enable row level security;

grant all on table manager_profiles to service_role;
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
-- Rotate the pass tokens that were exposed in scratch/api_debug.log.
--
-- That file was committed to the repository, so every token below has to be
-- treated as public: anyone holding one could present it at the gate, and the
-- legitimate attendee would then be turned away as "already used".
--
-- The registration ID (the part before the underscore) is preserved so payment
-- records and admin lookups still line up; only the pass code half changes.
-- Already-delivered QR emails stop working, so re-send passes afterwards with
--   node scripts/resend-passes.js <email> [...]

begin;

create temporary table leaked_tokens (token text primary key);

insert into leaked_tokens (token) values
  ('10431_MAHAZ409H'),
  ('24236_MAH1PHQDC'),
  ('24236_MAH9QXIFW'),
  ('24236_MAHLBOB3U'),
  ('36597_MAH88WASZ'),
  ('36597_MAHF1KHE8'),
  ('36597_MAHONWQ2X'),
  ('63982_MAHBUMIKP'),
  ('93789_MAH2OPAEW'),
  ('93789_MAHOUA3AF'),
  ('93789_MAHYK2M5V'),
  ('MAH-MU35G4GB-8XLZ'),
  ('MAH-MU35G4GB-9DQ8');

-- Remember which rows are being rotated so the result can be verified after.
create temporary table rotated as
select id, token as old_token, participant_name, email
from tickets
where token in (select token from leaked_tokens);

update tickets t
set token =
  case
    when position('_' in t.token) > 0 then split_part(t.token, '_', 1)
    else lpad((10000 + floor(random() * 90000))::int::text, 5, '0')
  end
  || '_MAH'
  || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))
where t.id in (select id from rotated);

-- Old and new token side by side, plus the addresses that need a fresh pass.
select r.old_token, t.token as new_token, t.participant_name, t.email, t.status
from rotated r
join tickets t on t.id = r.id
order by t.created_at;

commit;
-- The music playlist shown on the homepage, editable from the admin UI.
--
-- Run this in the Supabase SQL editor. Additive and safe to re-run.
--
-- It lives in the database rather than in public/data/playlists.json because
-- the filesystem is read-only on Vercel - the same reason admin edits to
-- events.json do not survive a deploy. The JSON file stays as the fallback
-- when no row is set.
--
-- Only the extracted YouTube playlist id is stored, never a pasted URL. The
-- id is constrained to the character set YouTube actually uses, so nothing
-- that reaches the page can carry a scheme, a host or markup.

create table if not exists site_playlist (
  -- Single-row table: the id is pinned so an upsert always targets one row.
  id boolean primary key default true,
  constraint site_playlist_singleton check (id),

  -- e.g. PLKDZ1ig0uz-U. Validated in the app before it is written, and again
  -- when it is read.
  youtube_playlist_id text,
  constraint site_playlist_id_charset
    check (youtube_playlist_id is null or youtube_playlist_id ~ '^[A-Za-z0-9_-]{1,64}$'),

  -- Shown in the player before YouTube reports the first track title.
  name text not null default 'Playlist',

  is_enabled boolean not null default true,
  updated_at timestamptz default now(),
  updated_by text
);

-- Same posture as the other tables: denied to anon, reached only through the
-- service-role client in the API routes. The public homepage reads it through
-- a server component, not from the browser.
alter table site_playlist enable row level security;

grant all on table site_playlist to service_role;
-- Reporting and fixing a payment that reached the wrong collector.
--
-- A manager sees a payment because tickets.receiver_upi matches the UPI id on
-- their profile. That is right almost always, and wrong in the cases that
-- matter: a payer mistypes the handle, OCR reads a neighbouring id off the
-- receipt, or two collectors share a QR poster. The payment then sits in a
-- queue belonging to somebody with no way to confirm it and no way to pass it
-- on, and the registrant waits.
--
-- receiver_upi is left exactly as it was. It records where the money actually
-- went, and rewriting it to fix a queue would destroy the one field that says
-- what happened. The override is a separate column, so the record and the
-- routing stay separable.

alter table tickets
  -- Set when a manager says this is not theirs. While set and unassigned, the
  -- payment leaves every manager's queue and appears in the super admin's
  -- Wrong Allocations list.
  add column if not exists allocation_flagged_at timestamptz,
  add column if not exists allocation_flag_reason text,
  -- Which manager reported it, for an audit trail and so the super admin can
  -- see who it came from.
  add column if not exists allocation_flagged_by uuid references manager_profiles(id),
  -- The override. When set, this manager verifies the payment regardless of
  -- receiver_upi; when null, routing falls back to receiver_upi as before.
  add column if not exists assigned_manager_id uuid references manager_profiles(id),
  add column if not exists assigned_at timestamptz,
  add column if not exists assigned_by text;

-- The super admin's Wrong Allocations tab is "flagged and not yet reassigned",
-- and every manager's queue filters on the override, so both are indexed.
create index if not exists tickets_allocation_flagged_idx
  on tickets (allocation_flagged_at)
  where allocation_flagged_at is not null;

create index if not exists tickets_assigned_manager_idx
  on tickets (assigned_manager_id)
  where assigned_manager_id is not null;
