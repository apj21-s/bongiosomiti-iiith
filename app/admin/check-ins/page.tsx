import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminTier } from '@/utils/auth/server'
import CheckinsClient from './CheckinsClient'

export const revalidate = 0

export default async function AdminCheckinsPage() {
  const tier = await getAdminTier()
  if (tier < 2) redirect('/admin')
  return (
    <main className="admin-page-content" data-admin-checkins>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0, lineHeight: 1.2, letterSpacing: '-0.03em', color: '#1a202c' }}>Check-in Logs</h1>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <Link className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} href="/admin/scanner">Open Scanner &rarr;</Link>
          <Link className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }} href="/admin">Dashboard &rarr;</Link>
        </div>
      </div>

      <CheckinsClient />
    </main>
  )
}
