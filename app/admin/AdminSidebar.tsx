'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from './LogoutButton'

export default function AdminSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/admin' && pathname === '/admin') return true
    if (path !== '/admin' && pathname?.startsWith(path)) return true
    return false
  }

  const toggleDrawer = () => setIsOpen(!isOpen)
  const closeDrawer = () => setIsOpen(false)

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
            <Link href="/admin" className={`admin-nav-link ${isActive('/admin') ? 'active' : ''}`} onClick={closeDrawer}>📊 Overview</Link>
            <Link href="/admin/registrations" className={`admin-nav-link ${isActive('/admin/registrations') ? 'active' : ''}`} onClick={closeDrawer}>👥 Registrations</Link>
            <Link href="/admin/payments" className={`admin-nav-link ${isActive('/admin/payments') ? 'active' : ''}`} onClick={closeDrawer}>💳 Payments</Link>
            <Link href="/admin/check-ins" className={`admin-nav-link ${isActive('/admin/check-ins') ? 'active' : ''}`} onClick={closeDrawer}>📋 Check-ins</Link>
            <div className="dropdown-divider"></div>
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2d3748' }}>Admin User</div>
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
          
          <Link href="/admin" className={`admin-nav-link ${isActive('/admin') ? 'active' : ''}`} onClick={closeDrawer}>
            <span style={{ marginRight: '10px' }}>📊</span> Overview
          </Link>
          <Link href="/admin/registrations" className={`admin-nav-link ${isActive('/admin/registrations') ? 'active' : ''}`} onClick={closeDrawer}>
            <span style={{ marginRight: '10px' }}>👥</span> Registrations
          </Link>
          <Link href="/admin/payments" className={`admin-nav-link ${isActive('/admin/payments') ? 'active' : ''}`} onClick={closeDrawer}>
            <span style={{ marginRight: '10px' }}>💳</span> Payments
          </Link>
          <Link href="/admin/check-ins" className={`admin-nav-link ${isActive('/admin/check-ins') ? 'active' : ''}`} onClick={closeDrawer}>
            <span style={{ marginRight: '10px' }}>📋</span> Check-ins
          </Link>
          
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
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                BS
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2d3748' }}>Admin User</div>
                <div style={{ fontSize: '0.75rem', color: '#718096' }}>Organiser</div>
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>
    </>
  )
}
