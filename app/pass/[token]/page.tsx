import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceRoleClient } from '@/utils/supabase/server'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import QRWrapper from './QRWrapper'
import LookupForm from './LookupForm'
import PrintButton from './PrintButton'

export default async function PassPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createServiceRoleClient()
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select(`
      *,
      event:events (
        slug,
        name,
        venue
      )
    `)
    .eq('token', token.toUpperCase())
    .single()

  if (error || !ticket) {
    notFound()
  }

  // Calculate the status text and badge class
  let statusText = ticket.status
  if (ticket.status === 'PENDING_PAYMENT' || ticket.payment_status === 'PENDING') {
    statusText = 'PAYMENT_PENDING'
  } else if (ticket.status === 'PAYMENT_REJECTED') {
    statusText = 'PAYMENT_REJECTED'
  } else if (ticket.status === 'USED') {
    statusText = 'USED'
  } else if (ticket.status === 'UNUSED' && ticket.payment_status === 'APPROVED') {
    statusText = 'UNUSED'
  } else {
    statusText = 'BLOCKED'
  }

  return (
<>
      <SiteHeader />
      <main className="pass-world" data-pass-page style={{padding: '1.5rem 1rem 3rem', }}>
      <section className="pass-world__scene panel" style={{maxWidth: '1040px', margin: '0 auto', }}>
        <div className="panel-head">
          <div>
            <p className="section-label">Digital Entry Pass</p>
            <h1>Show this QR Pass at the Gate</h1>
            <p className="text-muted">Present this verified pass on your phone screen or bring a printout for entry verification.</p>
          </div>
          <div style={{display: 'flex', gap: '8px', alignItems: 'center', }}>
            <span className={`badge pass-world__status ${statusText !== 'UNUSED' ? 'badge--error' : ''}`}>{statusText}</span>
            <PrintButton />
          </div>
        </div>

        <div className="pass-world__layout">
          <div className="pass-world__art">
            <div className="pass-world__artBlock">
              <h2 className="pass-world__event">BANGIYA.SAMITI</h2>
              <p className="pass-world__venue">Campus Venue</p>
              <p className="pass-world__demoNote">Verified Digital Cultural Pass &bull; IIIT Hyderabad Bangiya Samiti</p>
              <div className="pass-world__artImage">
                <img className="pass-world__artVisual" src="/assets/digital-pass-reference.svg" alt="Pass artwork" />
              </div>
              <div style={{marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '8px', }}>
                <button type="button" className="btn btn-primary pass-world__openScanner">Test In Gate Scanner &rarr;</button>
                <Link href="/events" className="btn btn-secondary" style={{textAlign: 'center', }}>&larr; Browse More Events</Link>
              </div>
            </div>
          </div>

          <div className="pass-world__card">
            <article className="qr-pass" aria-label="Digital BANGIYA.SAMITI Pass">
              <div className="qr-pass__top">
                <p className="qr-pass__eyebrow">IIIT HYDERABAD &bull; BANGIYA.SAMITI</p>
                <h2 className="qr-pass__title pass-world__event" style={{margin: '0.25rem 0', }}>{ticket.event?.name}</h2>
                <p className="qr-pass__subtitle pass-world__venue">{ticket.event?.venue}</p>
              </div>

              <div className="qr-pass__body">
                <div className="qr-pass__details">
                  <div><span>Attendee Name</span><strong className="pass-world__attendee">{ticket.participant_name}</strong></div>
                  <div><span>College ID</span><strong className="pass-world__collegeId">{ticket.college_id}</strong></div>
                  <div><span>Pass Token</span><strong className="pass-world__token" style={{fontFamily: 'monospace', letterSpacing: '0.05em', }}>{ticket.token}</strong></div>
                  <div><span>Issue Date</span><strong className="pass-world__date">{new Date(ticket.created_at).toLocaleDateString()}</strong></div>
                  <div><span>Venue / Gate</span><strong className="pass-world__venue">{ticket.event?.venue}</strong></div>
                  <div><span>Payment Proof</span><strong className="pass-world__utr">{ticket.utr || (ticket.amount === 0 ? 'Free' : 'N/A')}</strong></div>
                </div>

                <div className="qr-pass__qrWrap">
                  <div className="qr-pass__qrFrame pass-world__qr">
                    <QRWrapper text={ticket.token} />
                  </div>
                  <div className="qr-pass__status" style={{marginTop: '0.75rem', }}>
                    <span className={`badge pass-world__status ${statusText !== 'UNUSED' ? 'badge--error' : ''}`}>{statusText}</span>
                  </div>
                </div>
              </div>

              <div className="qr-pass__footer">
                <div><span>Access Type</span><strong>General Entry</strong></div>
                <div><span>Security</span><strong>Dynamic Hash Validated</strong></div>
                <div><span>Status</span><strong className={`pass-world__status ${statusText !== 'UNUSED' ? 'text-error' : ''}`}>{statusText}</strong></div>
              </div>
            </article>
          </div>
        </div>

        
        <div style={{padding: '1.5rem 24px', background: 'rgba(255,255,255,0.4)', borderTop: '1px solid var(--border)', marginTop: '1.5rem', borderRadius: '0 0 28px 28px', }}>
          <LookupForm />
        </div>
      </section>
    </main>
    <SiteFooter />
    </>
  )
}
