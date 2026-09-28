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
