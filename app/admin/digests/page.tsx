import { redirect } from 'next/navigation'
import { getAdminIdentity } from '@/utils/auth/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import DigestsClient from './DigestsClient'

export const dynamic = 'force-dynamic'

export default async function AdminDigestsPage() {
  const { tier } = await getAdminIdentity()
  if (tier < 3) redirect('/admin')

  const supabase = await createServiceRoleClient()
  const { data: managers } = await supabase
    .from('manager_profiles')
    .select('*')
    .order('name')

  return (
    <main className="admin-page-content">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '2rem', margin: '0 0 8px', lineHeight: 1.2, color: '#1a202c' }}>
          Send Manager Digests
        </h1>
        <p style={{ margin: 0, color: '#718096', maxWidth: '600px' }}>
          Manually trigger the daily digest email for a specific manager or all managers. 
          The digest will only send if the manager has pending or newly reallocated payments.
        </p>
      </div>

      <DigestsClient initialManagers={managers || []} />
    </main>
  )
}
