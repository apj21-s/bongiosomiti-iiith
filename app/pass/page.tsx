'use client'

import { useState } from 'react'
import Link from 'next/link'
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
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [notFound, setNotFound] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setTicket(null)
    setNotFound(null)
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
        setNotFound(data.error || 'No registration found')
      }
    } catch (err: any) {
      setNotFound(err.message)
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
                  <label htmlFor="verification-query"><span>College ID, Email, Phone, or Pass Token <span className="required-star">*</span></span></label>
                  <input type="text" id="verification-query" name="query" className="verification-input" placeholder="e.g. 202401042 or MBH-DEMO-001" required autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
                  <span className="verification-hint">Enter the information you provided during your event pass registration.</span>
                </div>

                <button type="submit" className="verification-submit-btn" disabled={loading}>
                  {loading ? 'CHECKING...' : 'CHECK STATUS →'}
                </button>
              </form>

              {(ticket || notFound) && (
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
                          <tr><td>Registration ID</td><td><code>{ticket.token}</code></td></tr>
                          <tr><td>Attendee Name</td><td><strong>{ticket.participantName}</strong></td></tr>
                          <tr><td>Registered Email</td><td>{ticket.email}</td></tr>
                          <tr><td>Event &amp; Venue</td><td>{ticket.eventName} ({ticket.venue})</td></tr>
                          <tr><td>Submitted UTR / Ref</td><td><strong>{ticket.utr}</strong></td></tr>
                          <tr><td>Expected Amount</td><td>{formatCurrency(ticket.amount)}</td></tr>
                          <tr><td>Submission Timestamp</td><td>{formatDate(ticket.verificationSubmittedAt || ticket.createdAt)}</td></tr>
                        </tbody>
                      </table>

                      {isVerified && (
                        <div className="verified-pass-showcase">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '1.5px solid rgba(223,200,174,0.5)', paddingBottom: '14px', marginBottom: '18px' }}>
                            <div>
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', color: '#8f3c1d', textTransform: 'uppercase' }}>OFFICIAL ENTRY PASS</span>
                              <h3 style={{ margin: '2px 0 0', fontSize: '1.35rem' }}>{ticket.eventName}</h3>
                            </div>
                            <span className="badge badge--verified">VERIFIED • READY FOR ENTRY</span>
                          </div>

                          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ flex: 1, minWidth: '260px' }}>
                              <table className="verification-meta-table" style={{ margin: 0 }}>
                                <tbody>
                                  <tr><td>Event Name</td><td><strong>{ticket.eventName}</strong></td></tr>
                                  <tr><td>Participant Name</td><td><strong>{ticket.participantName}</strong></td></tr>
                                  <tr><td>Registration ID</td><td><code>{ticket.token}</code></td></tr>
                                  <tr><td>Venue</td><td>{ticket.venue}</td></tr>
                                  <tr><td>Status</td><td><strong style={{ color: '#2e7d32' }}>Verified &amp; Active</strong></td></tr>
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-primary" onClick={handleResend} disabled={loading} style={{ padding: '12px 24px', fontWeight: 'bold' }}>
                              {loading ? 'SENDING...' : '✉️ SEND QR PASS TO EMAIL'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {notFound && (
                    <div className="status-result-panel">
                      <div className="status-banner status-banner--rejected" role="status" aria-live="polite">
                        <span className="status-banner__icon">✕</span>
                        <div><h2 className="status-banner__title">NO REGISTRATION FOUND</h2><p className="status-banner__desc">{notFound}</p></div>
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
