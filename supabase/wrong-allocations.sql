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
