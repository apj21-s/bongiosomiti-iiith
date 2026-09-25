'use client'

import { useState } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import { QRCodeSVG } from 'qrcode.react'

type Ticket = {
  token: string
  participantName: string
  email: string
  eventName: string
  venue: string
  utr: string
  amount: number
  payment_status: string
  status: string
  createdAt: string
  verificationSubmittedAt: string
  numPasses?: number
  redeemedCount?: number
  allTokens?: string[]
}

function formatDate(iso: string) {
  if (!iso) return 'N/A'
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatCurrency(n: number) {
  return n === 0 ? 'Free' : `₹${n.toLocaleString('en-IN')}`
}

export default function PassVerifyPage() {
  notFound()
  
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [isNotFound, setIsNotFound] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setTicket(null)
    setIsNotFound(null)
    try {
      const res = await fetch('/api/pass/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = await res.json()
      if (res.ok) {
        setTicket(data)
      } else {
        setIsNotFound(data.error || 'No registration found')
      }
    } catch (err: any) {
      setIsNotFound(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setLoading(true)
    try {
      const res = await fetch('/api/pass/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: ticket?.token })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to resend')
      alert(data.message)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  const status = ticket?.payment_status?.toLowerCase()
  const isVerified = status === 'approved' || status === 'verified'

  return (
    <>
      <SiteHeader />
      <main className="verification-world" data-pass-page id="top">
        <div className="verification-shell">
          <section className="verification-card" aria-labelledby="verification-heading">
            <div className="verification-header">
              <span className="verification-header__eyebrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                  <line x1="1" y1="10" x2="23" y2="10"></line>
                </svg>
                Payment Verification Portal
              </span>
              <h1 id="verification-heading" className="verification-header__title">Check Your Payment Status</h1>
              <p className="verification-header__sub">Enter your details below to track your ticket payment status.</p>
            </div>

            <div className="verification-body">
              <form className="verification-form" onSubmit={handleSubmit} noValidate>
                <div className="verification-field">
                  <label htmlFor="verification-query"><span>Phone Number or Reference Number <span className="required-star">*</span></span></label>
                  <input type="text" id="verification-query" name="query" className="verification-input" placeholder="e.g. 9876543210 or UTSAV-XYZ-123" required autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
                  <span className="verification-hint">Enter the information you provided during your event pass registration.</span>
                </div>

                <button type="submit" className="verification-submit-btn" disabled={loading}>
                  {loading ? 'CHECKING...' : 'CHECK STATUS →'}
                </button>
              </form>

              {(ticket || isNotFound) && (
                <div style={{ display: 'block', marginTop: '2rem' }}>
                  {ticket && (
                    <div className="status-result-panel">
                      {status === 'approved' || status === 'verified' ? (
                        <div className="status-banner status-banner--verified" role="status" aria-live="polite">
                          <span className="status-banner__icon">✓</span>
                          <div><h2 className="status-banner__title">PAYMENT VERIFIED ✓</h2><p className="status-banner__desc">Your payment has been verified by the organisers. Your digital entry pass is now active and has been dispatched to your email.</p></div>
                        </div>
                      ) : status === 'rejected' ? (
                        <div className="status-banner status-banner--rejected" role="status" aria-live="polite">
                          <span className="status-banner__icon">✕</span>
                          <div><h2 className="status-banner__title">PAYMENT VERIFICATION NEEDS ATTENTION</h2><p className="status-banner__desc">We could not verify the payment details submitted. Please check your transaction information or contact the organisers.</p></div>
                        </div>
                      ) : (
                        <div className="status-banner status-banner--pending" role="status" aria-live="polite">
                          <span className="status-banner__icon">◷</span>
                          <div><h2 className="status-banner__title">VERIFICATION REQUEST RECEIVED ✓</h2><p className="status-banner__desc">Your payment details have been submitted successfully. Your digital pass will be sent to your registered email once your payment is confirmed.</p></div>
                        </div>
                      )}

                      <div className="compact-status-box" aria-label="Current verification lifecycle">
                        <div className="compact-status-grid">
                          <div className="compact-status-item"><span className="compact-status-item__label">Registration</span><strong className="compact-status-item__value compact-status-item__value--success">✓ Received</strong></div>
                          <div className="compact-status-item">
                            <span className="compact-status-item__label">Payment</span>
                            {isVerified ? (
                              <strong className="compact-status-item__value compact-status-item__value--success">✓ Verified</strong>
                            ) : status === 'rejected' ? (
                              <strong className="compact-status-item__value compact-status-item__value--rejected">✕ Verification Failed</strong>
                            ) : (
                              <strong className="compact-status-item__value compact-status-item__value--pending">◷ Under verification</strong>
                            )}
                          </div>
                          <div className="compact-status-item">
                            <span className="compact-status-item__label">Digital Pass</span>
                            {isVerified ? (
                              <strong className="compact-status-item__value compact-status-item__value--success">✓ Sent to email</strong>
                            ) : (
                              <strong className="compact-status-item__value compact-status-item__value--awaiting">— Awaiting confirmation</strong>
                            )}
                          </div>
                        </div>
                      </div>

                      <table className="verification-meta-table">
                        <tbody>
                          <tr><td>Registration ID</td><td><code>{ticket?.token}</code> {(ticket?.numPasses || 0) > 1 && <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>(+{(ticket?.numPasses || 1) - 1} more passes)</span>}</td></tr>
                          <tr><td>Check-in Status</td><td>{ticket?.numPasses === 1 ? (ticket?.redeemedCount === 1 ? <strong className="compact-status-item__value--success">✓ Availed</strong> : 'Not Availed') : <strong>{ticket?.redeemedCount} / {ticket?.numPasses} Availed</strong>}</td></tr>
                          <tr><td>Attendee Name</td><td><strong>{ticket?.participantName}</strong></td></tr>
                          <tr><td>Registered Email</td><td>{ticket?.email}</td></tr>
                          <tr><td>Event &amp; Venue</td><td>{ticket?.eventName} ({ticket?.venue})</td></tr>
                          <tr><td>Submitted UTR / Ref</td><td><strong>{ticket?.utr}</strong></td></tr>
                          <tr><td>Expected Amount</td><td>{formatCurrency(ticket?.amount || 0)} {(ticket?.numPasses || 0) > 1 && <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>(for {ticket?.numPasses} passes)</span>}</td></tr>
                          <tr><td>Submission Timestamp</td><td>{formatDate(ticket?.verificationSubmittedAt || ticket?.createdAt || '')}</td></tr>
                        </tbody>
                      </table>


                    </div>
                  )}

                  {isNotFound && (
                    <div className="status-result-panel">
                      <div className="status-banner status-banner--rejected" role="status" aria-live="polite">
                        <span className="status-banner__icon">✕</span>
                        <div><h2 className="status-banner__title">NO REGISTRATION FOUND</h2><p className="status-banner__desc">{isNotFound}</p></div>
                      </div>
                      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                        <Link href="/events" className="btn btn-primary">Browse Events &amp; Register →</Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
