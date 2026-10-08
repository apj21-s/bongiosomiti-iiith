import { redirect } from 'next/navigation'
import { getAdminTier } from '@/utils/auth/server'
import { getEvents } from '@/utils/data/events'
import { passLabel, passTypesOf } from '@/utils/pricing'
import PlateChangesClient from './PlateChangesClient'

export const revalidate = 0

export default async function AdminPlateChangesPage() {
  // Raising a change rewrites somebody's booking and asks for money to move.
  // Every route checks the tier too; this only keeps the page away.
  const tier = await getAdminTier()
  if (tier < 3) redirect('/admin')

  const events = await getEvents()

  // Suggestions only. A change may name any plate - the super admin is the
  // authority here, and an event whose config never made it into the database
  // must not stop them fixing somebody's booking.
  const platesByEvent: Record<string, string[]> = {}
  for (const event of events as any[]) {
    platesByEvent[event.id] = passTypesOf(event).map(passLabel)
  }

  return (
    <main className="admin-page-content" data-admin-plate-changes>
      <div style={{ marginBottom: '28px' }}>
        <p className="section-label" style={{ marginBottom: '8px' }}>Registrations</p>
        <h1 style={{ fontSize: '2rem', margin: 0, lineHeight: 1.2, letterSpacing: '-0.03em', color: '#1a202c' }}>
          Plate Changes
        </h1>
        <p style={{ margin: '8px 0 0', color: '#718096', maxWidth: '820px' }}>
          Look a booking up by the participant&rsquo;s address, the collector&rsquo;s address, the
          registration number or a single pass code. Change whatever needs changing, say what
          has to move and which way, and both sides are emailed. Nothing on the passes changes
          until you have seen the receipt and approved it here.
        </p>
      </div>

      <PlateChangesClient platesByEvent={platesByEvent} />
    </main>
  )
}
