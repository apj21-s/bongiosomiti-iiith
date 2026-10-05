'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from './LogoutButton'

type AdminTier = 1 | 2 | 3

/** 0 is nobody: signed out, or a session the server would not vouch for. */
type KnownTier = AdminTier | 0

export default function AdminSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  /**
   * What the server says this session is, or null while it has not said yet.
   *
   * Two things went wrong here, and they compounded.
   *
   * The fetch ran once, on mount - and this component mounts on the sign-in
   * page, where nobody is signed in. Signing in is a client-side redirect to
   * /admin, which does not remount the layout, so the answer from the sign-in
   * page was the answer it kept. That is why the menu was right only after a
   * reload: a reload is the one thing that mounts it again. Asking again when
   * the route changes is the actual fix.
   *
   * The second was `d.tier || 3`, which turned the case the endpoint is most
   * careful about into the worst one: it answers `{ tier: 0 }` when it cannot
   * vouch for a session, and `0 || 3` is 3. Together these showed the whole
   * super-admin menu to a signed-out visitor and to gate staff alike.
   *
   * Null is not 0 and not a tier to guess at: until an answer arrives nothing
   * gated is drawn, so nothing appears that then has to be taken away.
   *
   * The pages and the API routes were never fooled by any of this; each
   * checks the tier itself. It was only ever the menu that lied.
   */
  const [tier, setTier] = useState<KnownTier | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false
    const settle = (value: KnownTier) => { if (!cancelled) setTier(value) }

    // no-store: the answer is about who is signed in, which changes without
    // the URL changing, and a cached 0 would outlive the sign-in that fixed it.
    fetch('/api/admin/tier', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { tier: 0 }))
      .then(d => {
        const value = Number(d?.tier)
        settle(value === 1 || value === 2 || value === 3 ? value : 0)
      })
      // Whatever went wrong, it is not evidence of privilege.
      .catch(() => settle(0))

    return () => { cancelled = true }
    // Re-asked on every route change, which is what carries the answer across
    // the redirect out of the sign-in page.
  }, [pathname])

  /** Anything gated waits for a real answer rather than assuming one. */
  const canSee = (minimum: AdminTier) => tier !== null && tier >= minimum

  const isActive = (path: string) => {
    if (path === '/admin' && pathname === '/admin') return true
    if (path !== '/admin' && pathname?.startsWith(path)) return true
    return false
  }

  const toggleDrawer = () => setIsOpen(!isOpen)
  const closeDrawer = () => setIsOpen(false)

  const tierLabel = tier === 1 ? 'Gate Staff' : tier === 2 ? 'Manager' : tier === 3 ? 'Super Admin' : ''

  // The sign-in page has no navigation: the links do not work signed out, and
  // listing them tells a stranger the shape of the admin area for nothing.
  if (pathname === '/admin/login') return null

  return (
    <>
      {/* Top Header (Visible mainly on mobile, but structural on desktop too) */}
      <header className="admin-top-header">
        <div className="admin-top-header-mobile">
          <Link href="/admin" className="admin-sidebar-brand" onClick={closeDrawer}>
            BANGIYA.SAMITI
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link href="/admin/scanner" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px' }}>
              📷 Scanner
            </Link>
            <button 
              type="button" 
              onClick={toggleDrawer}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px 10px', color: 'var(--brand)', cursor: 'pointer', fontSize: '1.2rem' }}
            >
              ☰
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Overlay */}
        {isOpen && (
          <div 
            style={{ position: 'fixed', inset: 0, top: '60px', background: 'rgba(0,0,0,0.5)', zIndex: 4, backdropFilter: 'blur(4px)' }}
            onClick={closeDrawer}
          ></div>
        )}

        {/* Mobile Dropdown Menu */}
        {isOpen && (
          <nav className="admin-mobile-dropdown">
            <Link href="/" className="admin-nav-link" onClick={closeDrawer}>🌍 Public Website</Link>
            <div className="dropdown-divider"></div>
            {canSee(2) && (
              <Link href="/admin" className={`admin-nav-link ${isActive('/admin') ? 'active' : ''}`} onClick={closeDrawer}>📊 Overview</Link>
            )}
            {tier === 1 && (
              <Link href="/admin" className={`admin-nav-link ${isActive('/admin') ? 'active' : ''}`} onClick={closeDrawer}>📊 Check-in Activity</Link>
            )}
            {canSee(3) && (
              <Link href="/admin/registrations" className={`admin-nav-link ${isActive('/admin/registrations') ? 'active' : ''}`} onClick={closeDrawer}>👥 Registrations</Link>
            )}
            {canSee(2) && (
              <Link href="/admin/payments" className={`admin-nav-link ${isActive('/admin/payments') ? 'active' : ''}`} onClick={closeDrawer}>💳 Payments</Link>
            )}
            {canSee(3) && (
              <Link href="/admin/allocations" className={`admin-nav-link ${isActive('/admin/allocations') ? 'active' : ''}`} onClick={closeDrawer}>🔀 Wrong Allocations</Link>
            )}
            {canSee(2) && (
              <Link href="/admin/check-ins" className={`admin-nav-link ${isActive('/admin/check-ins') ? 'active' : ''}`} onClick={closeDrawer}>📋 Check-ins</Link>
            )}
            {canSee(3) && (
              <Link href="/admin/events" className={`admin-nav-link ${isActive('/admin/events') ? 'active' : ''}`} onClick={closeDrawer}>🎭 Manage Cultural Events</Link>
            )}
            {canSee(3) && (
              <Link href="/admin/coupons" className={`admin-nav-link ${isActive('/admin/coupons') ? 'active' : ''}`} onClick={closeDrawer}>🎟️ Manage Coupons</Link>
            )}
            {canSee(3) && (
              <Link href="/admin/statistics" className={`admin-nav-link ${isActive('/admin/statistics') ? 'active' : ''}`} onClick={closeDrawer}>📈 Statistics</Link>
            )}
            {canSee(3) && (
              <Link href="/admin/managers" className={`admin-nav-link ${isActive('/admin/managers') ? 'active' : ''}`} onClick={closeDrawer}>👥 Manager Profiles</Link>
            )}
            {canSee(3) && (
              <Link href="/admin/digests" className={`admin-nav-link ${isActive('/admin/digests') ? 'active' : ''}`} onClick={closeDrawer}>📧 Send Digests</Link>
            )}
            {canSee(3) && (
              <Link href="/admin/playlist" className={`admin-nav-link ${isActive('/admin/playlist') ? 'active' : ''}`} onClick={closeDrawer}>🎵 Homepage Music</Link>
            )}
            <div className="dropdown-divider"></div>
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2d3748' }}>{tierLabel}</div>
                {tier ? <div style={{ fontSize: '0.7rem', color: '#a0aec0' }}>Tier {tier}</div> : null}
              </div>
              <LogoutButton />
            </div>
          </nav>
        )}
      </header>

      {/* Desktop Sidebar (Hidden on Mobile) */}
      <aside className="admin-sidebar desktop-only">
        <div className="admin-sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/admin" className="admin-sidebar-brand" onClick={closeDrawer}>
            BANGIYA.SAMITI
          </Link>
        </div>

        <nav className="admin-sidebar-nav">
          <Link href="/" className="admin-nav-link" onClick={closeDrawer}>
            <span style={{ marginRight: '10px' }}>🌍</span> Public Website
          </Link>
          
          <div style={{ margin: '16px 0 8px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Dashboard
          </div>
          
          {canSee(1) && (
            <Link href="/admin" className={`admin-nav-link ${isActive('/admin') ? 'active' : ''}`} onClick={closeDrawer}>
              <span style={{ marginRight: '10px' }}>📊</span> {tier === 1 ? 'Check-in Activity' : 'Overview'}
            </Link>
          )}
          {canSee(3) && (
            <Link href="/admin/registrations" className={`admin-nav-link ${isActive('/admin/registrations') ? 'active' : ''}`} onClick={closeDrawer}>
              <span style={{ marginRight: '10px' }}>👥</span> Registrations
            </Link>
          )}
          {canSee(2) && (
            <Link href="/admin/payments" className={`admin-nav-link ${isActive('/admin/payments') ? 'active' : ''}`} onClick={closeDrawer}>
              <span style={{ marginRight: '10px' }}>💳</span> Payments
            </Link>
          )}
          {canSee(3) && (
            <Link href="/admin/allocations" className={`admin-nav-link ${isActive('/admin/allocations') ? 'active' : ''}`} onClick={closeDrawer}>
              <span style={{ marginRight: '10px' }}>🔀</span> Wrong Allocations
            </Link>
          )}
          {canSee(2) && (
            <Link href="/admin/check-ins" className={`admin-nav-link ${isActive('/admin/check-ins') ? 'active' : ''}`} onClick={closeDrawer}>
              <span style={{ marginRight: '10px' }}>📋</span> Check-ins
            </Link>
          )}
          {canSee(3) && (
            <Link href="/admin/events" className={`admin-nav-link ${isActive('/admin/events') ? 'active' : ''}`} onClick={closeDrawer}>
              <span style={{ marginRight: '10px' }}>🎭</span> Manage Cultural Events
            </Link>
          )}
          {/* The coupon list is edited here and only here; the event editor
              shows it read-only and links across. */}
          {canSee(3) && (
            <Link href="/admin/coupons" className={`admin-nav-link ${isActive('/admin/coupons') ? 'active' : ''}`} onClick={closeDrawer}>
              <span style={{ marginRight: '10px' }}>🎟️</span> Manage Coupons
            </Link>
          )}
          {/* Money across every collector, so super admin only - the page
              redirects a lower tier on its own. */}
          {canSee(3) && (
            <Link href="/admin/statistics" className={`admin-nav-link ${isActive('/admin/statistics') ? 'active' : ''}`} onClick={closeDrawer}>
              <span style={{ marginRight: '10px' }}>📈</span> Statistics
            </Link>
          )}
          {canSee(3) && (
            <Link href="/admin/managers" className={`admin-nav-link ${isActive('/admin/managers') ? 'active' : ''}`} onClick={closeDrawer}>
              <span style={{ marginRight: '10px' }}>👥</span> Manager Profiles
            </Link>
          )}
          {canSee(3) && (
            <Link href="/admin/digests" className={`admin-nav-link ${isActive('/admin/digests') ? 'active' : ''}`} onClick={closeDrawer}>
              <span style={{ marginRight: '10px' }}>📧</span> Send Digests
            </Link>
          )}
          {canSee(3) && (
            <Link href="/admin/playlist" className={`admin-nav-link ${isActive('/admin/playlist') ? 'active' : ''}`} onClick={closeDrawer}>
              <span style={{ marginRight: '10px' }}>🎵</span> Homepage Music
            </Link>
          )}

          <div style={{ margin: '16px 0 8px 16px', fontSize: '0.75rem', fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Tools
          </div>

          <Link href="/admin/scanner" className={`admin-nav-link ${isActive('/admin/scanner') ? 'active' : ''}`} onClick={closeDrawer}>
            <span style={{ marginRight: '10px' }}>📷</span> Gate Scanner
          </Link>
        </nav>

        <div className="admin-sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: tier === 3 ? 'var(--brand)' : tier === 2 ? '#2b6cb0' : '#718096', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.75rem' }}>
                {tier ? `T${tier}` : ''}
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2d3748' }}>{tierLabel}</div>
                {tier ? <div style={{ fontSize: '0.75rem', color: '#718096' }}>Tier {tier}</div> : null}
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>
    </>
  )
}
