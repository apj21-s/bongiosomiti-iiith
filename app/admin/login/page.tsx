'use client'

import { useState } from 'react'
import { loginAction } from './actions'
import Link from 'next/link'

export default function AdminLoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const res = await loginAction(formData)
    if (res?.error) {
      setError(res.error)
      setLoading(false)
    }
    // On success the server action redirects; stay in loading state
  }

  return (
    <>
      {/* Full-screen loading overlay shown while server action runs */}
      {loading && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '20px',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <div style={{
            width: '52px', height: '52px',
            border: '4px solid #f0e6d3',
            borderTop: '4px solid #7c3a1e',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: '1.15rem', color: '#3d1a0b', margin: '0 0 6px' }}>
              Signing in…
            </p>
            <p style={{ fontSize: '0.9rem', color: '#888', margin: 0 }}>
              Verifying your credentials, please wait
            </p>
          </div>
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          `}</style>
        </div>
      )}

      <main className="panel container" style={{ maxWidth: '580px', margin: '3rem auto', padding: '0' }}>
        <div className="panel-head" style={{ padding: '24px 28px' }}>
          <div>
            <p className="section-label">Organiser Security</p>
            <h1 style={{ fontSize: '2rem', margin: '4px 0 6px' }}>Admin Access</h1>
            <p>Sign in to access event controls, gate scanner verification, and payment records.</p>
          </div>
        </div>

        <div className="grid" style={{ padding: '24px 28px' }}>
          <form id="login-form" className="section" onSubmit={handleSubmit} style={{ padding: '0' }}>
            <div className="field" style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="email" style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                Email or manager username
              </label>
              <input
                id="email" name="email" type="text"
                autoComplete="username" spellCheck={false}
                placeholder="Enter your Email or Username"
                style={{ width: '100%', padding: '12px 16px', borderRadius: '14px', border: '1px solid var(--border)', fontSize: '1rem' }}
                disabled={loading}
                required
              />
            </div>

            <div className="field" style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="password" style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                Password
              </label>
              <input
                id="password" name="password" type="password"
                placeholder="Enter your Password"
                style={{ width: '100%', padding: '12px 16px', borderRadius: '14px', border: '1px solid var(--border)', fontSize: '1rem' }}
                disabled={loading}
                required
              />
            </div>

            <div className="row-actions" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                className="btn btn-primary"
                type="submit"
                style={{ width: '100%', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer', transition: 'opacity 0.2s' }}
                disabled={loading}
              >
                {loading ? 'Signing in…' : 'Sign In as Organiser →'}
              </button>
            </div>

            {error && (
              <div className="form-status form-status--error" aria-live="polite" style={{ marginTop: '1rem', display: 'block' }}>
                <span className="utsav-toast__icon">✕</span>
                <span>{error}</span>
              </div>
            )}
          </form>

          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <Link href="/login" className="text-muted" style={{ fontSize: '0.9rem' }}>
              &larr; Are you an Attendee? Lookup your pass here
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
