import Link from 'next/link'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { staticEvents } from '@/utils/data/events'
import SiteFooter from '@/components/site-footer'

export const revalidate = 0

export default async function AdminDashboardPage() {
  const supabase = await createServiceRoleClient()

  const eventCount = staticEvents.length
  const { count: ticketCount } = await supabase.from('tickets').select('*', { count: 'exact', head: true })

  const { data: paidTickets } = await supabase.from('tickets').select('amount').eq('payment_status', 'APPROVED')
  const revenue = (paidTickets || []).reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)

  const { count: checkinCount } = await supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'USED')

  const { data: recentRegistrations } = await supabase
    .from('tickets')
    .select(`*, event:events(name)`)
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: recentCheckins } = await supabase
    .from('checkins')
    .select(`*, ticket:tickets(participant_name, event:events(name))`)
    .order('created_at', { ascending: false })
    .limit(5)

  function formatDate(iso: string) {
    if (!iso) return 'N/A'
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <main className="panel container" data-admin-dashboard style={{ maxWidth: '1300px', margin: '2rem auto', padding: '0' }}>
      <div className="panel-head" style={{ padding: '24px 28px' }}>
        <div>
          <p className="section-label">Organiser Operations Center</p>
          <h1 style={{ fontSize: '2rem', margin: '4px 0 6px' }}>Event Operations Dashboard</h1>
          <p>Real-time overview of college cultural events, registration passes, payments, and gate scanner entries.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link className="btn btn-secondary" href="/admin/scanner">📷 Launch Scanner</Link>
        </div>
      </div>

      <div className="grid" style={{ padding: '24px 28px' }}>
        <div className="summary-bar" style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div className="stat-card">
            <span className="stat-card__label">Active Events</span>
            <strong className="stat-card__val">{eventCount || 0}</strong>
            <small className="text-muted">In public catalog</small>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Total Registrations</span>
            <strong className="stat-card__val">{ticketCount || 0}</strong>
            <small className="text-muted">Passes issued</small>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Revenue Collected</span>
            <strong className="stat-card__val">₹{revenue.toLocaleString('en-IN')}</strong>
            <small className="text-muted">Verified UPI &amp; bookings</small>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Verified Check-ins</span>
            <strong className="stat-card__val">{checkinCount || 0}</strong>
            <small className="text-muted">Scanned at gates</small>
          </div>
        </div>

        <div className="admin-quick-nav" style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          <Link className="btn btn-secondary" href="/admin/events">📅 Manage Events</Link>
          <Link className="btn btn-secondary" href="/admin/registrations">👥 View Registrations</Link>
          <Link className="btn btn-secondary" href="/admin/payments">💳 Review Payments</Link>
          <Link className="btn btn-secondary" href="/admin/scanner">📱 QR Gate Scanner</Link>
          <Link className="btn btn-secondary" href="/admin/check-ins">📋 Check-in Activity Log</Link>
        </div>

        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '24px', marginTop: '1.5rem' }}>
          <div className="admin-card" style={{ background: 'rgba(255,255,255,0.75)', borderRadius: '20px', border: '1px solid var(--border)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Recent Registrations</h3>
              <Link href="/admin/registrations" className="btn btn-sm btn-secondary">View All &rarr;</Link>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr><th>Attendee</th><th>Event</th><th>Token</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {(recentRegistrations || []).length === 0 && <tr><td colSpan={5} className="text-muted">No registrations yet.</td></tr>}
                  {(recentRegistrations || []).map((t: any) => (
                    <tr key={t.id}>
                      <td><strong>{t.participant_name}</strong><br /><small>{t.college_id || ''}</small></td>
                      <td>{t.event?.name}</td>
                      <td><Link href={`/pass/${t.token}`}><code>{t.token}</code></Link></td>
                      <td><span className="badge">{t.status}</span></td>
                      <td>{formatDate(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-card" style={{ background: 'rgba(255,255,255,0.75)', borderRadius: '20px', border: '1px solid var(--border)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Gate Check-in Activity</h3>
              <Link href="/admin/check-ins" className="btn btn-sm btn-secondary">View All &rarr;</Link>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr><th>Attendee</th><th>Event</th><th>Gate</th><th>Timestamp</th></tr>
                </thead>
                <tbody>
                  {(recentCheckins || []).length === 0 && <tr><td colSpan={4} className="text-muted">No check-in entries yet.</td></tr>}
                  {(recentCheckins || []).map((c: any) => (
                    <tr key={c.id}>
                      <td><strong>{c.ticket?.participant_name}</strong></td>
                      <td>{c.ticket?.event?.name}</td>
                      <td><span className="pill">{c.gate}</span></td>
                      <td>{formatDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ gridColumn: '1 / -1', marginTop: '2rem', padding: '18px 24px', background: 'rgba(255,255,255,0.5)', borderRadius: '18px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <strong>Organiser Backend Active</strong>
            <p className="text-muted" style={{ margin: 0, fontSize: '0.85rem' }}>Registrations, payments, scanner logs, and events persist in the application database.</p>
          </div>
          <Link className="btn btn-sm btn-secondary" href="/" target="_blank">Preview Public Site &rarr;</Link>
        </div>
      </div>

      <SiteFooter variant="admin" />
    </main>
  )
}
