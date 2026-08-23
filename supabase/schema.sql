-- Create tables
create table events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  event_date date not null,
  venue text not null,
  capacity int not null,
  price int not null default 0,
  category text,
  description text,
  image_url text,
  status text not null default 'OPEN',
  created_at timestamptz default now()
);

create table admin_profiles (
  id uuid primary key references auth.users(id),
  name text,
  email text,
  role text not null default 'organiser'
);

create table tickets (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  event_id uuid references events(id),
  participant_name text not null,
  college_id text,
  email text,
  phone text,
  utr text,
  payment_proof_url text,
  amount int not null,
  payment_status text not null default 'PENDING',
  status text not null default 'PENDING_PAYMENT',
  num_passes int not null default 1,
  food_pref text,
  is_iiit boolean,
  coupon_code text,
  discount_amount int not null default 0,
  redeemed_at timestamptz,
  redeemed_gate text,
  redeemed_by uuid references admin_profiles(id),
  created_at timestamptz default now()
);

create table checkins (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references tickets(id),
  gate text not null,
  scanned_by uuid references admin_profiles(id),
  created_at timestamptz default now()
);

-- Additive migration for existing databases (safe to re-run)
alter table tickets
  add column if not exists num_passes int not null default 1,
  add column if not exists food_pref text,
  add column if not exists is_iiit boolean,
  add column if not exists coupon_code text,
  add column if not exists discount_amount int not null default 0;

-- Enable RLS
alter table events enable row level security;
alter table admin_profiles enable row level security;
alter table tickets enable row level security;
alter table checkins enable row level security;

-- Setup RLS Policies

-- Events: Public select where status = 'OPEN'
create policy "Public can view OPEN events" on events
  for select using (status = 'OPEN');

-- Tickets: Deny all to anon. Only accessible via service_role in API.
-- (No policies needed, RLS default deny applies to anon, service_role bypasses RLS)

-- Checkins: Deny all to anon. Only accessible via service_role in API.
-- (No policies needed, RLS default deny applies to anon, service_role bypasses RLS)

-- Admin profiles: User can select their own row.
create policy "Users can view their own profile" on admin_profiles
  for select using (id = auth.uid());

-- Grant privileges to anon, authenticated, and service_role roles
-- (RLS will still restrict actual data access for anon/auth, while service_role bypasses it)
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
