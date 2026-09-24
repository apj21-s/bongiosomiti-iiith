import { getEventBySlug } from '@/utils/data/events'
import { getAdminTier } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import EventEditorClient from './EventEditorClient'

export const revalidate = 0

export default async function EditEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const tier = await getAdminTier()
  if (tier < 3) redirect('/admin')
  
  const { slug } = await params;
  const event = getEventBySlug(slug)

  if (!event) {
    return (
      <main className="admin-page-content">
        <h1>Event Not Found</h1>
        <Link href="/admin/events" className="btn btn-secondary">Back</Link>
      </main>
    )
  }

  return (
    <main className="admin-page-content" data-admin-events-edit>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <p className="section-label" style={{ marginBottom: '8px' }}>Event Settings</p>
          <h1 style={{ fontSize: '2rem', margin: 0, lineHeight: 1.2, letterSpacing: '-0.03em', color: '#1a202c' }}>
            Edit {event.name}
          </h1>
        </div>
        <div style={{ flexShrink: 0 }}>
          <Link className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }} href="/admin/events">&larr; Back</Link>
        </div>
      </div>

      <EventEditorClient event={event} />
    </main>
  )
}
