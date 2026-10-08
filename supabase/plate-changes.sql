-- Changing a pass from one plate to another, and the money that moves with it.
--
-- Run this in the Supabase SQL editor before deploying the plate-change
-- feature. It is additive and safe to re-run.
--
-- A change is never applied the moment it is asked for. Swapping a veg lunch
-- for a non-veg one is a different price, so somebody has to send somebody
-- money first - the participant to the collector, or the collector back to the
-- participant - and only a super admin who has seen the receipt may say that
-- happened. This table is that waiting room: one row per change, carrying what
-- it was, what it is becoming, who owes whom, and who settled it.
--
-- The ticket itself is not touched until the row reaches APPROVED. Until then
-- the pass in somebody's inbox is still true.

create table if not exists plate_changes (
  id uuid primary key default gen_random_uuid(),

  -- The one pass being changed. A booking of three plates is three tickets,
  -- and a change applies to exactly one of them.
  ticket_id uuid not null references tickets(id) on delete cascade,
  event_id uuid references events(id),

  -- Plate labels as they are written into tickets.food_pref: the string
  -- passLabel() produces, e.g. "Lunch · Veg".
  from_plate text not null,
  to_plate text not null,

  -- What the pass cost, and what it will cost. Whole rupees, like tickets.amount.
  from_amount int not null,
  to_amount int not null,
  -- to_amount - from_amount. Positive: the participant owes. Negative: the
  -- collector owes a refund. Zero: a swap at the same price, nothing to send.
  delta int not null,

  -- Who sends the money, and who therefore has to produce the receipt - which
  -- is the other one, the party that receives it.
  --   PARTICIPANT  the participant pays the collector
  --   COLLECTOR    the collector refunds the participant
  --   NOBODY       same price either way
  payer text not null check (payer in ('PARTICIPANT', 'COLLECTOR', 'NOBODY')),

  -- Where the money goes, and who to tell. Copied at the time rather than
  -- looked up later, so the record still reads correctly after a manager
  -- profile is renamed or removed.
  collector_upi text,
  collector_email text,
  collector_name text,

  --   AWAITING_TRANSFER  asked for, money not yet confirmed
  --   APPROVED           a super admin saw the receipt; the ticket is updated
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
create index if not exists plate_changes_ticket_idx on plate_changes (ticket_id);

-- One pass cannot be in two unsettled changes at once: two rows waiting would
-- each be priced against from_amount, and approving both would charge the
-- difference twice while the pass only changed once.
create unique index if not exists plate_changes_one_open_per_ticket
  on plate_changes (ticket_id)
  where status = 'AWAITING_TRANSFER';

alter table plate_changes enable row level security;

-- Reached only through the service-role client in the admin API routes, which
-- check the tier themselves. No anon or authenticated policy is wanted: a
-- participant has no business reading the queue.
grant all on table plate_changes to service_role;
