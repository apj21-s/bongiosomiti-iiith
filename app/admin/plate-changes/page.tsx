import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminTier } from '@/utils/auth/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { getEvents } from '@/utils/data/events'
import { passLabel, passTypesOf } from '@/utils/pricing'
import PlateChangesClient, { type ChangeablePass } from './PlateChangesClient'

export const revalidate = 0

export default async function AdminPlateChangesPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>
}) {
  // Raising a change writes to somebody's booking and asks for money to move.
  // The API checks the tier on every call; this only keeps the page away.
  const tier = await getAdminTier()
  if (tier < 3) redirect('/admin')

  const { event: wanted } = await searchParams
  const events = await getEvents()
  const supabase = await createServiceRoleClient()

  const { data: allTickets } = await supabase
    .from('tickets')
    .select('id, token, participant_name, email, food_pref, amount, event_id')
    .eq('payment_status', 'APPROVED')
    .order('created_at', { ascending: false })

  const tickets = (allTickets || []) as (ChangeablePass & { event_id: string | null })[]

  // Open on an event somebody has actually booked, rather than an empty list.
  const perEvent = new Map<string, number>()
  for (const t of tickets) if (t.event_id) perEvent.set(t.event_id, (perEvent.get(t.event_id) ?? 0) + 1)
  const busiest = [...perEvent.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const event =
    events.find((e: any) => e.slug === wanted) ||
    events.find((e: any) => e.id === busiest) ||
    events[0]

  if (!event) {
    return (
      <main className="admin-page-content">
        <h1 style={{ fontSize: '2rem', margin: 0 }}>Plate Changes</h1>
        <p className="text-muted">No events are configured yet.</p>
      </main>
    )
  }

  const plates = passTypesOf(event).map(passLabel)
  const passes = tickets.filter((t) => t.event_id === event.id)

  return (
    <main className="admin-page-content" data-admin-plate-changes>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <p className="section-label" style={{ marginBottom: '8px' }}>Registrations</p>
          <h1 style={{ fontSize: '2rem', margin: 0, lineHeight: 1.2, letterSpacing: '-0.03em', color: '#1a202c' }}>Plate Changes</h1>
          <p style={{ margin: '8px 0 0', color: '#718096', maxWidth: '780px' }}>
            Move one pass from one plate to another. The difference is sent between the
            participant and whoever collected their payment; nothing on the pass changes
            until you have seen the receipt and approved it here.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {events.length > 1 && events.map((e: any) => (
            <Link key={e.slug} href={`/admin/plate-changes?event=${e.slug}`}
              className={`btn ${e.slug === event.slug ? 'btn-primary' : 'btn-secondary'}`}>
              {e.name}
            </Link>
          ))}
        </div>
      </div>

      {plates.length === 0 && (
        <div className="form-status form-status--error" style={{ display: 'block', marginBottom: '20px' }}>
          <strong>{event.name}</strong> has no plates configured, so a difference cannot be
          worked out from the price table. You can still raise a change by typing the plate
          and the amount yourself.
        </div>
      )}

      <PlateChangesClient eventName={event.name} plates={plates} passes={passes} />
    </main>
  )
}
