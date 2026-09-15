import Link from 'next/link'
import PaymentsClient from './PaymentsClient'

export const revalidate = 0

export default function AdminPaymentsPage() {
  return (
    <main className="admin-page-content" data-admin-payments>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0, lineHeight: 1.2, letterSpacing: '-0.03em', color: '#1a202c' }}>Payment Verification</h1>
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
