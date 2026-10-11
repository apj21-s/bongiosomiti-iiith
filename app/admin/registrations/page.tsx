import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getEventScope } from '@/utils/admin/event-scope'
import { getAdminTier } from '@/utils/auth/server'
import RegistrationsClient from './RegistrationsClient'

export const revalidate = 0

export default async function AdminRegistrationsPage() {
  const tier = await getAdminTier()
  if (tier < 3) redirect('/admin')

  // Opens on the event picked in the sidebar; the filter on the page can
  // still widen it.
  const { events: allEvents, event } = await getEventScope()
  const events = allEvents.map((e) => ({ slug: e.slug, name: e.name }))

  return (
    <main className="admin-page-content" data-admin-registrations>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0, lineHeight: 1.2, letterSpacing: '-0.03em', color: '#1a202c' }}>Registrations</h1>
        </div>
        <Link className="btn btn-primary" href="/admin">Dashboard &rarr;</Link>
      </div>

      <RegistrationsClient initialEvents={events || []} initialEventSlug={event?.slug ?? 'all'} />
    </main>
  )
}
