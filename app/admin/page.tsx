import Link from 'next/link'
import { createServiceRoleClient } from '@/utils/supabase/server'
import SiteFooter from '@/components/site-footer'

export const revalidate = 0

export default async function AdminDashboardPage() {
  const supabase = await createServiceRoleClient()

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
    <main className="admin-page-content">
      <div style={{ marginBottom: '32px' }}>
        <p className="section-label" style={{ marginBottom: '8px' }}>Organiser Operations Center</p>
        <h1 style={{ fontSize: '2.5rem', margin: '0 0 8px', lineHeight: 1.2, letterSpacing: '-0.03em', color: '#1a202c' }}>Event Operations Dashboard</h1>
        <p style={{ margin: 0, color: '#718096', fontSize: '1.1rem', maxWidth: '800px' }}>Real-time overview of college cultural events, registration passes, payments, and gate scanner entries.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div className="admin-stat-card">
          <span className="admin-stat-label">Registrations</span>
          <div className="admin-stat-value">{ticketCount || 0}</div>
          <div className="admin-stat-desc">Passes issued</div>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-label">Revenue Collected</span>
          <div className="admin-stat-value">₹{revenue.toLocaleString('en-IN')}</div>
          <div className="admin-stat-desc">Verified UPI & bookings</div>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-label">Check-ins</span>
          <div className="admin-stat-value">{checkinCount || 0}</div>
          <div className="admin-stat-desc">Scanned at gates</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: '24px', alignItems: 'start' }}>
        <div className="admin-section-card" style={{ marginTop: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: 'clamp(1.05rem, 3vw, 1.15rem)' }}>Recent Registrations</h3>
              <Link href="/admin/registrations" className="btn btn-sm btn-secondary" style={{ whiteSpace: 'nowrap' }}>View All &rarr;</Link>
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

          <div className="admin-section-card" style={{ marginTop: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#2d3748' }}>Gate Check-in Activity</h3>
              <Link href="/admin/check-ins" className="btn btn-sm btn-secondary" style={{ whiteSpace: 'nowrap' }}>View All &rarr;</Link>
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


      {/* We removed the site footer here to keep the admin interface clean and full-height */}
    </main>
  )
}
