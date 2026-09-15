import Link from 'next/link'
import { staticEvents } from '@/utils/data/events'
import EventsTable from './EventsTable'

export const revalidate = 0

export default async function AdminEventsPage() {
  const events = staticEvents

  return (
    <main className="panel container" data-admin-events style={{ maxWidth: '1300px', margin: '2rem auto', padding: '0' }}>
      <div className="panel-head" style={{ padding: '24px 28px' }}>
        <div>
          <p className="section-label">Events Directory</p>
          <h1 style={{ fontSize: '2rem', margin: '4px 0 6px' }}>Manage Cultural Events</h1>
          <p>Configure event listings, monitor booking capacity, manage ticket pricing, and open public pages.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link className="btn btn-secondary" href="/admin">Dashboard &rarr;</Link>
        </div>
      </div>

      <div className="grid" style={{ padding: '24px 28px' }}>
        <div className="table-responsive" style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.7)', borderRadius: '20px', border: '1px solid var(--border)', padding: '14px' }}>
          <EventsTable events={events || []} />
        </div>
      </div>
    </main>
  )
}
