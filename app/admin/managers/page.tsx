import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminTier } from '@/utils/auth/server'
import ManagersClient from './ManagersClient'

export const revalidate = 0

export default async function AdminManagersPage() {
  // Creating accounts is a super-admin job. The API enforces this too; this
  // redirect only keeps the page out of the way.
  const tier = await getAdminTier()
  if (tier < 3) redirect('/admin')

  return (
    <main className="admin-page-content" data-admin-managers>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <p className="section-label" style={{ marginBottom: '8px' }}>Access Control</p>
          <h1 style={{ fontSize: '2rem', margin: 0, lineHeight: 1.2, letterSpacing: '-0.03em', color: '#1a202c' }}>Manager Profiles</h1>
          <p style={{ margin: '8px 0 0', color: '#718096' }}>
            Each manager verifies only the payments made to their own UPI ID.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link className="btn btn-secondary" href="/admin/payments">Payments &rarr;</Link>
          <Link className="btn btn-primary" href="/admin">Dashboard &rarr;</Link>
        </div>
      </div>

      <ManagersClient />
    </main>
  )
}
