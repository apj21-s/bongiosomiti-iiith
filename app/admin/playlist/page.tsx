import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminTier } from '@/utils/auth/server'
import PlaylistClient from './PlaylistClient'

export const revalidate = 0

export default async function AdminPlaylistPage() {
  // Changing what plays on the public site is a super-admin job. The API
  // enforces this too; the redirect only keeps the page out of the way.
  const tier = await getAdminTier()
  if (tier < 3) redirect('/admin')

  return (
    <main className="admin-page-content" data-admin-playlist>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <p className="section-label" style={{ marginBottom: '8px' }}>Site Content</p>
          <h1 style={{ fontSize: '2rem', margin: 0, lineHeight: 1.2, letterSpacing: '-0.03em', color: '#1a202c' }}>Homepage Music</h1>
          <p style={{ margin: '8px 0 0', color: '#718096' }}>
            The playlist that plays over the video on the home page.
          </p>
        </div>
        <Link className="btn btn-primary" href="/admin">Dashboard &rarr;</Link>
      </div>

      <PlaylistClient />
    </main>
  )
}
