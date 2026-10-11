-- Which managers collect for which event.
--
-- Run this in the Supabase SQL editor before assigning managers to events.
-- It is additive and safe to re-run.
--
-- Each event is its own setup: the people collecting for Mahalaya need not be
-- the ones collecting for Saraswati. A manager keeps one login and one UPI id
-- across events; this table only says which events they collect for.
--
-- The rule the application applies:
--   an event with rows here      -> only those managers' UPI ids are offered
--                                   on its registration form and accepted by
--                                   the register route
--   an event with no rows here   -> every active manager, as before this table
--                                   existed, so nothing changes until someone
--                                   actually sets an event up
--
-- Payment queues are not narrowed by this. A payment made to a manager's UPI
-- id is in their account whichever event it was for, and they are the one who
-- can confirm it arrived.

create table if not exists manager_events (
  manager_id uuid not null references manager_profiles(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (manager_id, event_id)
);

create index if not exists manager_events_event_idx on manager_events (event_id);

-- Same posture as the other tables: deny to anon, reached only through the
-- service-role client in the API routes.
alter table manager_events enable row level security;

grant all on table manager_events to service_role;
