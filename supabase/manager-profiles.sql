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

create index if not exists manager_profiles_upi_idx on manager_profiles (lower(upi_id));
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
