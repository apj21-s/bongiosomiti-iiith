import Link from 'next/link'
import CheckinsClient from './CheckinsClient'

export const revalidate = 0

export default function AdminCheckinsPage() {
  return (
    <main className="panel container" data-admin-checkins style={{ maxWidth: '1300px', margin: '2rem auto', padding: '0' }}>
      <div className="panel-head" style={{ padding: '24px 28px' }}>
        <div>
          <p className="section-label">Security &amp; Gate Audit</p>
          <h1 style={{ fontSize: '2rem', margin: '4px 0 6px' }}>Gate Check-in Logs</h1>
          <p>Real-time audit log of all passes redeemed at college entry gates and celebration courtyards.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link className="btn btn-primary" href="/admin/scanner">Open Scanner &rarr;</Link>
          <Link className="btn btn-secondary" href="/admin">Dashboard &rarr;</Link>
        </div>
      </div>

      <CheckinsClient />
    </main>
  )
}
