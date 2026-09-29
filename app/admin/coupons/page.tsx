import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminTier } from '@/utils/auth/server'
import CouponsClient from './CouponsClient'

export const revalidate = 0

export default async function AdminCouponsPage() {
  // Coupons change what people pay. The API enforces tier 3 on every call;
  // this redirect only keeps the page out of the way.
  const tier = await getAdminTier()
  if (tier < 3) redirect('/admin')

  return (
    <main className="admin-page-content" data-admin-coupons>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <p className="section-label" style={{ marginBottom: '8px' }}>Pricing</p>
          <h1 style={{ fontSize: '2rem', margin: 0, lineHeight: 1.2, letterSpacing: '-0.03em', color: '#1a202c' }}>Coupon Codes</h1>
          <p style={{ margin: '8px 0 0', color: '#718096', maxWidth: '760px' }}>
            Add, change, switch off and delete the codes visitors can apply at payment.
            Every code is checked on the server when it is applied and again when the booking is made.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link className="btn btn-secondary" href="/admin/events">Events &rarr;</Link>
          <Link className="btn btn-primary" href="/admin">Dashboard &rarr;</Link>
        </div>
      </div>

      <CouponsClient />
    </main>
  )
}
