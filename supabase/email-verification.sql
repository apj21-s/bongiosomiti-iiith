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
