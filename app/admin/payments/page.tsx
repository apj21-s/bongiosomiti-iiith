import Link from 'next/link'
import PaymentsClient from './PaymentsClient'

export const revalidate = 0

export default function AdminPaymentsPage() {
  return (
    <main className="panel container" data-admin-payments style={{ maxWidth: '1360px', margin: '2rem auto', padding: '0' }}>
      <div className="panel-head" style={{ padding: '24px 28px' }}>
        <div>
          <p className="section-label">Finance &amp; Verification Suite</p>
          <h1 style={{ fontSize: '2rem', margin: '4px 0 6px' }}>Payment Verification Requests</h1>
          <p>Review attendee UPI Transaction IDs (UTRs), verify settlement against bank proofs, and authorize digital QR pass dispatch.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link className="btn btn-secondary" href="/admin/registrations">View Registrations &rarr;</Link>
          <Link className="btn btn-primary" href="/admin">Dashboard &rarr;</Link>
        </div>
      </div>

      <PaymentsClient />
    </main>
  )
}
