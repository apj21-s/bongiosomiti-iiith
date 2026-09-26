// The env-credential admins (tiers 1-3) have synthetic ids like "admin-tier-2"
// rather than rows in admin_profiles. Columns such as tickets.redeemed_by and
// checkins.scanned_by are uuid foreign keys, so writing a synthetic id there
// makes Postgres reject the whole statement:
//
//   invalid input syntax for type uuid: "admin-tier-1"
//
// which failed the check-in itself, not just the attribution. Tier admins are
// therefore recorded as null; the gate name on the row still says where the scan
// happened. Supabase-auth admins, who do have a profile row, are unaffected.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function toDbUserId(id: unknown): string | null {
  return typeof id === 'string' && UUID.test(id) ? id : null
}
