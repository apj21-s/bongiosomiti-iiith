import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getEvents } from '@/utils/data/events'
import { getAdminTier } from '@/utils/auth/server'
import EventsTable from './EventsTable'

export const revalidate = 0

export default async function AdminEventsPage() {
  const tier = await getAdminTier()
  if (tier < 3) redirect('/admin')

  const events = getEvents()

  return (
    <main className="panel container admin-dashboard-main" data-admin-events style={{ maxWidth: '1300px', margin: '2rem auto', padding: '0 clamp(12px, 3vw, 24px)', overflowX: 'hidden' }}>
      <div className="panel-head admin-header-responsive" style={{ padding: 'clamp(16px, 4vw, 24px) clamp(16px, 4vw, 28px)', display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'flex-start', background: 'rgba(255,255,255,0.7)', borderRadius: '20px', border: '1px solid var(--border)' }}>
        <div style={{ flex: '1 1 min-content', minWidth: 'min(100%, 280px)' }}>
          <p className="section-label" style={{ marginBottom: '4px' }}>Events Directory</p>
          <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', margin: '0 0 6px', lineHeight: 1.2 }}>Manage Cultural Events</h1>
          <p style={{ margin: 0, color: 'var(--muted)' }}>Configure event listings, monitor booking capacity, manage ticket pricing, and open public pages.</p>
        </div>
        <div style={{ flexShrink: 0, display: 'flex' }}>
          <Link className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }} href="/admin">Dashboard &rarr;</Link>
        </div>
      </div>

      <div className="grid" style={{ padding: 'clamp(16px, 4vw, 24px) 0' }}>
        <div className="table-wrapper-outer" style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '20px', border: '1px solid var(--border)', padding: 'clamp(12px, 2vw, 16px)', minWidth: 0, width: '100%' }}>
          <div className="table-responsive">
            <EventsTable events={events || []} />
          </div>
        </div>
      </div>
    </main>
  )
}
