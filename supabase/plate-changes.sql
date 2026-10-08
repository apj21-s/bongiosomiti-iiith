-- Changing a registration, and the money that moves with it.
--
-- Run this in the Supabase SQL editor before using the Plate Changes page.
-- It is additive and safe to re-run.
--
-- A change is never applied the moment it is asked for. Moving a veg lunch to a
-- non-veg one is a different price, so somebody has to send somebody money
-- outside the site first - the participant to the collector, or the collector
-- back to the participant - and only a super admin who has seen the receipt may
-- say that happened. This table is that waiting room. The tickets themselves
-- are not touched until the row reaches APPROVED, so the passes already in
-- somebody's inbox stay true until then.
--
-- One row per change, not per pass. A registration is one booking, one payment
-- and one person, and somebody rearranging it - this plate up, that one down,
-- a third left alone - is doing one thing that is settled with one transfer and
-- described in one email. `passes` carries the per-pass detail.

create table if not exists plate_changes (
  id uuid primary key default gen_random_uuid(),

  -- The booking: the part of a ticket token before the underscore, which is
  -- how the register route builds it. Text rather than a foreign key because
  -- it is not a row anywhere - it is the name a group of tickets shares.
  registration_id text not null,
  event_id uuid references events(id),

  -- Copied at the time rather than looked up later, so the record still reads
  -- correctly after a name, an address or a manager profile changes.
  participant_name text,
  participant_email text,
  collector_upi text,
  collector_email text,
  collector_name text,

  -- What is being done, one entry per pass that moves:
  --   [{ "ticketId": uuid, "token": text, "fromPlate": text, "toPlate": text,
  --      "fromAmount": int, "toAmount": int }]
  -- A pass left alone is simply not in here.
  passes jsonb not null,

  -- What actually has to be sent, and which way. The super admin sets both:
  -- the per-pass amounts above are what the booking will say afterwards, and
  -- this is what changes hands, which is not always the same thing - a plate
  -- swapped as a goodwill fix moves no money at all.
  --   PARTICIPANT  the participant pays the collector
  --   COLLECTOR    the collector refunds the participant
  --   NOBODY       nothing to send
  delta int not null default 0,
  payer text not null default 'NOBODY'
    check (payer in ('PARTICIPANT', 'COLLECTOR', 'NOBODY')),

  --   AWAITING_TRANSFER  asked for, money not yet confirmed
  --   APPROVED           a super admin saw the receipt; the tickets are updated
  --   CANCELLED          called off before it was settled
  status text not null default 'AWAITING_TRANSFER'
    check (status in ('AWAITING_TRANSFER', 'APPROVED', 'CANCELLED')),

  -- Free text from the super admin: why the change, and later what the receipt
  -- showed. Not parsed by anything.
  reason text,
  settlement_note text,

  -- Who did what. Text rather than a foreign key because the super admin signs
  -- in on environment credentials and has no row of its own anywhere.
  initiated_by text,
  initiated_at timestamptz not null default now(),
  settled_by text,
  settled_at timestamptz
);

-- The list a super admin works from is "what is still waiting", newest first.
create index if not exists plate_changes_status_idx on plate_changes (status, initiated_at desc);
create index if not exists plate_changes_registration_idx on plate_changes (registration_id);

-- One booking cannot be in two unsettled changes at once. Both would be priced
-- against the plates the passes have now, and approving the second would write
-- its own idea of "before" over the first one's result.
create unique index if not exists plate_changes_one_open_per_registration
  on plate_changes (registration_id)
  where status = 'AWAITING_TRANSFER';

alter table plate_changes enable row level security;

-- Reached only through the service-role client in the admin API routes, which
-- check the tier themselves. No anon or authenticated policy is wanted: a
-- participant has no business reading the queue.
grant all on table plate_changes to service_role;
