import { notFound } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import Image from 'next/image'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import MenuCardModal from '@/components/menu-card-modal'
import RegistrationForm from './RegistrationForm'
import fs from 'fs'
import path from 'path'

// Force copy assets
try {
  const src = path.join(process.cwd(), 'Mahalaya_Registration_Assets_CLEAN_FINAL (2)');
  const dest = path.join(process.cwd(), 'public', 'mahalaya_registration_assets');
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true, force: true });
  }
} catch (e) {}

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
                <p className="saraswati-invitation-sub">You are cordially invited to celebrate the divine worship of Devi Saraswati &bull; 11 February 2027 &bull; IIIT Hyderabad</p>
              </div>

              <div className="saraswati-programme-grid">
                {[
                  { img: '/assets/saraswati-card-pushpanjali.png', variant: 'pushpanjali', time: '09:30 AM — 11:30 AM', title: 'Vedic Puja & Pushpanjali', desc: 'Sacred Vedic chanting, Shloka recitation & floral Pushpanjali in three batches.', loc: 'Campus Courtyard Mandir' },
                  { img: '/assets/saraswati-card-khichuri.png', variant: 'khichuri', time: '12:30 PM — 03:30 PM', title: 'Community Khichuri Prasad', desc: 'Gobindobhog Khichuri, Labra, Beguni, Tomato-Khejur Chutney, Papad & Mishti Payesh.', loc: 'Dining Hall & Covered Courtyard' },
                  { img: '/assets/saraswati-card-adda.png', variant: 'adda', time: '05:30 PM — 08:00 PM', title: 'Sandhya Aarti & Adda', desc: 'Dhunuchi Aarti, sitar & flute recitals, Rabindra Sangeet & campus cultural adda.', loc: 'Amphitheatre & Open Stage' },
                ].map((panel) => (
                  <article key={panel.title} className={`saraswati-programme-panel saraswati-programme-panel--${panel.variant}`}>
                    <img className="saraswati-programme-panel__artwork" src={panel.img} alt={panel.title} width={panel.variant === 'adda' ? 342 : 341} height={136} loading="lazy" decoding="async" />
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
              width={isMahalaya ? 1264 : 544}
              height={isMahalaya ? 848 : 880}
              loading="eager"
              fetchPriority="high"
              decoding="async"
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
                    <div className="mahalaya-timeline__item"><div className="mahalaya-timeline__dot"></div><strong className="mahalaya-timeline__title">Event date</strong><span className="mahalaya-timeline__desc">Celebrate autumn puja season (10 Oct 2026)</span></div>
                    <div className="mahalaya-timeline__item"><div className="mahalaya-timeline__dot"></div><strong className="mahalaya-timeline__title">Time/Slot</strong><span className="mahalaya-timeline__desc">Shared community feast (1:00 PM – 4:30 PM)</span></div>
                    <div className="mahalaya-timeline__item"><div className="mahalaya-timeline__dot"></div><strong className="mahalaya-timeline__title">Tradition</strong><span className="mahalaya-timeline__desc">Tradition &amp; cultural community dinner</span></div>
                  </>
                ) : (
                  <>
                    <div className="saraswati-timeline__item"><div className="saraswati-timeline__dot"></div><strong className="saraswati-timeline__title">Event Date</strong><span className="saraswati-timeline__desc">Auspicious Basant Panchami (11 Feb 2027)</span></div>
                    <div className="saraswati-timeline__item"><div className="saraswati-timeline__dot"></div><strong className="saraswati-timeline__title">Morning Pushpanjali</strong><span className="saraswati-timeline__desc">Morning Anjali &amp; Vedic chanting (9:30 AM – 11:30 AM)</span></div>
                    <div className="saraswati-timeline__item"><div className="saraswati-timeline__dot"></div><strong className="saraswati-timeline__title">Khichuri Prosad Lunch Feast</strong><span className="saraswati-timeline__desc">Grand sit-down community lunch (12:30 PM – 3:30 PM)</span></div>
                    <div className="saraswati-timeline__item"><div className="saraswati-timeline__dot"></div><strong className="saraswati-timeline__title">Sandhya Aarti &amp; Adda</strong><span className="saraswati-timeline__desc">Cultural evening, music &amp; Dhunuchi Naach (5:30 PM – 8:00 PM)</span></div>
                  </>
                )}
              </div>

              <div className="events-extras-row">

                <MenuCardModal slug={event.slug} />
              </div>
            </div>

            <div className={`${isMahalaya ? 'mahalaya-card__formPane' : 'saraswati-card__formPane saraswati-card__formPane--locked'}`} id="registration-form-container">
              {!isMahalaya && (
                <div className="saraswati-card__formLockedBg" style={{ backgroundImage: "url('/assets/saraswati-puja.webp')" }}></div>
              )}
              


              <RegistrationForm event={event} />

              {!isMahalaya && (
                <div className="saraswati-form-lock-overlay">
                  <div className="saraswati-form-lock-content">
                    <div className="saraswati-form-lock-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    </div>
                    <h4 className="saraswati-form-lock-title">Registrations Opening Soon</h4>
                    <p className="saraswati-form-lock-desc">Stay tuned!</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
