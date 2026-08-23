import Link from 'next/link'
import { createServiceRoleClient } from '@/utils/supabase/server'
import RegistrationsClient from './RegistrationsClient'

export const revalidate = 0

export default async function AdminRegistrationsPage() {
  const supabase = await createServiceRoleClient()
  const { data: events } = await supabase.from('events').select('slug, name')

  return (
    <main className="panel container" data-admin-registrations style={{ maxWidth: '1300px', margin: '2rem auto', padding: '0' }}>
      <div className="panel-head" style={{ padding: '24px 28px' }}>
        <div>
          <p className="section-label">Attendee Directory</p>
          <h1 style={{ fontSize: '2rem', margin: '4px 0 6px' }}>Event Registrations</h1>
          <p>Search, filter, and verify passes issued to students and community guests.</p>
        </div>
        <Link className="btn btn-primary" href="/admin">Dashboard &rarr;</Link>
      </div>

      <RegistrationsClient initialEvents={events || []} />
    </main>
  )
}
