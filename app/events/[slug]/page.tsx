import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import MenuCardModal from '@/components/menu-card-modal'
import RegistrationForm from './RegistrationForm'

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!event) {
    notFound()
  }

  const isMahalaya = slug === 'mahalaya'
  const isFree = event.price === 0
  const heroImage = isMahalaya ? '/assets/mahalaya-bhoj.webp' : '/assets/saraswati-puja.webp'

  return (
    <>
      <SiteHeader />

      {!isMahalaya && (
        <main className="saraswati-page">
          <section className="saraswati-invitation-section scroll-reveal" aria-labelledby="invitation-heading">
            <div className="saraswati-invitation-container">
              <div className="saraswati-invitation-header">
                <span className="saraswati-invitation-tag">বসন্ত পঞ্চমী ২০২৭</span>
                <h1 id="invitation-heading" className="saraswati-invitation-title">Saraswati Puja Programme &amp; Schedule</h1>
                <p className="saraswati-invitation-sub">You are cordially invited to celebrate the divine worship of Devi Saraswati &bull; 21 January 2027 &bull; IIIT Hyderabad</p>
              </div>

              <div className="saraswati-programme-grid">
                {[
                  { img: '/assets/saraswati-card-pushpanjali.png', variant: 'pushpanjali', time: '09:30 AM — 11:30 AM', title: 'Vedic Puja & Pushpanjali', desc: 'Sacred Vedic chanting, Shloka recitation & floral Pushpanjali in three batches.', loc: 'Campus Courtyard Mandir' },
                  { img: '/assets/saraswati-card-khichuri.png', variant: 'khichuri', time: '12:30 PM — 03:30 PM', title: 'Community Khichuri Prasad', desc: 'Gobindobhog Khichuri, Labra, Beguni, Tomato-Khejur Chutney, Papad & Mishti Payesh.', loc: 'Dining Hall & Covered Courtyard' },
                  { img: '/assets/saraswati-card-adda.png', variant: 'adda', time: '05:30 PM — 08:00 PM', title: 'Sandhya Aarti & Adda', desc: 'Dhunuchi Aarti, sitar & flute recitals, Rabindra Sangeet & campus cultural adda.', loc: 'Amphitheatre & Open Stage' },
                ].map((panel) => (
                  <article key={panel.title} className={`saraswati-programme-panel saraswati-programme-panel--${panel.variant}`}>
                    <img className="saraswati-programme-panel__artwork" src={panel.img} alt={panel.title} loading="lazy" decoding="async" />
                    <div className="saraswati-programme-panel__scrim" aria-hidden="true"></div>
                    <div className="saraswati-programme-panel__content">
                      <time className="saraswati-programme-panel__time">{panel.time}</time>
                      <h2 className="saraswati-programme-panel__title">{panel.title}</h2>
                      <p className="saraswati-programme-panel__desc">{panel.desc}</p>
                      <div className="saraswati-programme-panel__location">
                        <span className="saraswati-programme-panel__loc-prefix">Location:</span> {panel.loc}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </main>
      )}

      <main className={isMahalaya ? 'mahalaya-page' : 'saraswati-page'}>
        <section className={isMahalaya ? 'mahalaya-card' : 'saraswati-card'} aria-labelledby={isMahalaya ? 'mahalaya-title' : 'saraswati-title'}>
          <div className={isMahalaya ? 'mahalaya-card__hero' : 'saraswati-card__hero'}>
            <img
              className={isMahalaya ? 'mahalaya-card__heroImage' : 'saraswati-card__heroImage'}
              src={heroImage}
              alt={event.name}
            />
            <div className={isMahalaya ? 'mahalaya-card__heroBlend' : 'saraswati-card__heroBlend'} aria-hidden="true"></div>
            <div className={isMahalaya ? 'mahalaya-card__heroRibbon' : 'saraswati-card__heroRibbon'} aria-hidden="true">
              <span>{isMahalaya ? 'MAHALAYA BHOJ 2026' : 'SARASWATI PUJA 2027 • BASANT PANCHAMI'}</span>
            </div>
          </div>

          <div className={isMahalaya ? 'mahalaya-card__body' : 'saraswati-card__body'}>
            <div className={isMahalaya ? 'mahalaya-card__story' : 'saraswati-card__story'}>
              <div className={isMahalaya ? 'mahalaya-card__titleBlock' : 'saraswati-card__titleBlock'}>
                <h2 id={isMahalaya ? 'mahalaya-title' : 'saraswati-title'} className={isMahalaya ? 'mahalaya-title' : 'saraswati-title'}>
                  {isMahalaya ? 'MAHALAYA BHOJ PAGE' : 'SARASWATI PUJA 2027'}
                </h2>
                <p className={isMahalaya ? 'mahalaya-subtitle' : 'saraswati-subtitle'}>
                  {isMahalaya ? '(NEIGHBOURHOOD & BHOJ)' : '(CAMPUS PUJA & KHICHURI PROSAD)'}
                </p>
              </div>

              <div className={isMahalaya ? 'mahalaya-timeline' : 'saraswati-timeline'}>
                {isMahalaya ? (
                  <>
                    <div className="mahalaya-timeline__item"><div className="mahalaya-timeline__dot"></div><strong className="mahalaya-timeline__title">Event date</strong><span className="mahalaya-timeline__desc">Celebrate autumn puja season (12 Oct 2026)</span></div>
                    <div className="mahalaya-timeline__item"><div className="mahalaya-timeline__dot"></div><strong className="mahalaya-timeline__title">Time/Slot</strong><span className="mahalaya-timeline__desc">Shared community feast (1:00 PM – 4:30 PM)</span></div>
                    <div className="mahalaya-timeline__item"><div className="mahalaya-timeline__dot"></div><strong className="mahalaya-timeline__title">Tradition</strong><span className="mahalaya-timeline__desc">Tradition &amp; cultural community dinner</span></div>
                  </>
                ) : (
                  <>
                    <div className="saraswati-timeline__item"><div className="saraswati-timeline__dot"></div><strong className="saraswati-timeline__title">Event Date</strong><span className="saraswati-timeline__desc">Auspicious Basant Panchami (21 Jan 2027)</span></div>
                    <div className="saraswati-timeline__item"><div className="saraswati-timeline__dot"></div><strong className="saraswati-timeline__title">Morning Pushpanjali</strong><span className="saraswati-timeline__desc">Morning Anjali &amp; Vedic chanting (9:30 AM – 11:30 AM)</span></div>
                    <div className="saraswati-timeline__item"><div className="saraswati-timeline__dot"></div><strong className="saraswati-timeline__title">Khichuri Prosad Lunch Feast</strong><span className="saraswati-timeline__desc">Grand sit-down community lunch (12:30 PM – 3:30 PM)</span></div>
                    <div className="saraswati-timeline__item"><div className="saraswati-timeline__dot"></div><strong className="saraswati-timeline__title">Sandhya Aarti &amp; Adda</strong><span className="saraswati-timeline__desc">Cultural evening, music &amp; Dhunuchi Naach (5:30 PM – 8:00 PM)</span></div>
                  </>
                )}
              </div>

              <div className={isMahalaya ? 'mahalaya-payment-box' : 'saraswati-payment-box mahalaya-payment-box'}>
                <div className={isMahalaya ? 'mahalaya-payment-box__header' : 'saraswati-payment-box__header mahalaya-payment-box__header'}>
                  <span className={isMahalaya ? 'mahalaya-payment-box__icon' : 'saraswati-payment-box__icon mahalaya-payment-box__icon'}>💳</span>
                  <strong className={isMahalaya ? 'mahalaya-payment-box__title' : 'saraswati-payment-box__title mahalaya-payment-box__title'}>Payment Instructions</strong>
                </div>
                <div className={isMahalaya ? 'mahalaya-payment-box__content' : 'saraswati-payment-box__content mahalaya-payment-box__content'}>
                  {isFree ? (
                    <p>This event is <strong>free entry</strong>. Complete the registration form to receive your digital pass.</p>
                  ) : (
                    <>
                      <p><strong>Step 1:</strong> Pay <strong>₹250 / pass</strong> via UPI to: <code className={isMahalaya ? 'mahalaya-payment-box__upi' : 'saraswati-payment-box__upi mahalaya-payment-box__upi'}>bangiya.samiti.iith@okhdfcbank</code></p>
                      <p><strong>Step 2:</strong> Copy your 12-digit UPI UTR / Transaction ID.</p>
                      <p><strong>Step 3:</strong> Fill in the registration form on the right and submit. Your verified QR Pass will be dispatched to your email.</p>
                    </>
                  )}
                </div>
              </div>

              <MenuCardModal slug={event.slug} />
            </div>

            <div className={isMahalaya ? 'mahalaya-card__formPane' : 'saraswati-card__formPane'} id="registration-form-container">
              <div className={isMahalaya ? 'mahalaya-card__formHeader' : 'saraswati-card__formHeader'}>
                <h2 className={isMahalaya ? 'mahalaya-card__registerLabel' : 'saraswati-card__registerLabel'}>Register for {event.name}</h2>
                <p className={isMahalaya ? 'mahalaya-card__registerSub' : 'saraswati-card__registerSub'}>Quick 1-Minute Registration &bull; Instant QR Pass Dispatched</p>
              </div>

              <RegistrationForm event={event} />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
