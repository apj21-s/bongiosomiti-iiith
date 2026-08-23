'use client'

import { useState } from 'react'
import { loginAction } from './actions'
import Link from 'next/link'

export default function AdminLoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const res = await loginAction(formData)
    if (res?.error) {
      setError(res.error)
      setLoading(false)
    }
  }

  function handleQuickLogin() {
    const form = document.getElementById('login-form') as HTMLFormElement
    const emailInput = document.getElementById('email') as HTMLInputElement
    const passwordInput = document.getElementById('password') as HTMLInputElement
    
    if (emailInput && passwordInput && form) {
      emailInput.value = 'admin@gmail.com'
      passwordInput.value = 'admin123'
      form.requestSubmit()
    }
  }

  return (
    <main className="panel container" style={{maxWidth: '580px', margin: '3rem auto', padding: '0', }}>
      <div className="panel-head" style={{padding: '24px 28px', }}>
        <div>
          <p className="section-label">Organiser Security</p>
          <h1 style={{fontSize: '2rem', margin: '4px 0 6px', }}>Admin Access</h1>
          <p>Sign in to access event controls, gate scanner verification, and payment records.</p>
        </div>
      </div>

      <div className="grid" style={{padding: '24px 28px', }}>
        <form id="login-form" className="section" action={handleSubmit} style={{padding: '0', }}>
          <div className="field" style={{marginBottom: '1.25rem', }}>
            <label htmlFor="email" style={{fontWeight: '600', display: 'block', marginBottom: '6px', }}>Organiser Email</label>
            <input id="email" name="email" type="email" placeholder="admin@utsavpass.local" style={{width: '100%', padding: '12px 16px', borderRadius: '14px', border: '1px solid var(--border)', fontSize: '1rem', }} required defaultValue="admin@utsavpass.local" />
          </div>
          
          <div className="field" style={{marginBottom: '1.25rem', }}>
            <label htmlFor="password" style={{fontWeight: '600', display: 'block', marginBottom: '6px', }}>Password</label>
            <input id="password" name="password" type="password" placeholder="••••••••" style={{width: '100%', padding: '12px 16px', borderRadius: '14px', border: '1px solid var(--border)', fontSize: '1rem', }} required />
          </div>

          <div className="row-actions" style={{display: 'flex', flexDirection: 'column', gap: '10px', }}>
            <button className="btn btn-primary" type="submit" style={{width: '100%', }} disabled={loading}>{loading ? 'Signing in...' : 'Sign In as Organiser →'}</button>
            <button id="admin-quick-login-btn" className="btn btn-secondary" type="button" style={{width: '100%', }} onClick={handleQuickLogin}>⚡ One-Click Demo Admin Login</button>
          </div>

          {error && (
            <div className="form-status form-status--error" aria-live="polite" style={{marginTop: '1rem', display: 'block' }}>
              <span className="utsav-toast__icon">✕</span>
              <span>{error}</span>
            </div>
          )}
        </form>

        <div style={{marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', textAlign: 'center', }}>
          <Link href="/login" className="text-muted" style={{fontSize: '0.9rem', }}>&larr; Are you an Attendee? Lookup your pass here</Link>
        </div>
      </div>
    </main>
  )
}
