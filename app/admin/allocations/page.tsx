import { redirect } from 'next/navigation'
import { getAdminTier } from '@/utils/auth/server'
import AllocationsClient from './AllocationsClient'

export const revalidate = 0

export default async function AdminAllocationsPage() {
  // Deciding whose payment this is settles who may approve money, so it is a
  // super-admin job. The API enforces the same thing; this only keeps the page
  // out of everyone else's way.
  const tier = await getAdminTier()
  if (tier < 3) redirect('/admin')

  return (
    <main className="admin-page-content" data-admin-allocations>
      <div style={{ marginBottom: '32px' }}>
        <p className="section-label" style={{ marginBottom: '8px' }}>Payment Routing</p>
        <h1 style={{ fontSize: '2rem', margin: 0, lineHeight: 1.2, letterSpacing: '-0.03em', color: '#1a202c' }}>
          Wrong Allocations
        </h1>
        <p style={{ margin: '8px 0 0', color: '#718096', maxWidth: '68ch' }}>
          Payments a collector has reported as not theirs. They are out of every
          manager&rsquo;s queue until you route them, so nothing here is being
          verified by anyone. Assigning one moves it into that manager&rsquo;s
          list; the UPI ID on the receipt is left as it was, because it records
          where the money actually went.
        </p>
      </div>

      <AllocationsClient />
    </main>
  )
}
