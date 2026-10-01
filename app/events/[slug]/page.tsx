import { notFound } from 'next/navigation'
import { getEventBySlug } from '@/utils/data/events'
import { stripCoupons } from '@/utils/coupons'
import Image from 'next/image'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import MenuCardModal from '@/components/menu-card-modal'
import MeetTheTeam from '@/components/meet-the-team'
import RegistrationForm from './RegistrationForm'

export const dynamic = 'force-dynamic'

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const event = await getEventBySlug(slug)

  if (!event) {
    notFound()
  }

  const isMahalaya = slug === 'mahalaya'
  const isFree = event.price === 0
  const heroImage = isMahalaya ? '/assets/mahalaya-bhoj.webp' : '/assets/saraswati-puja.webp'

  /*
   * One root element, not a fragment.
   *
   * On a client-side navigation the router scrolls the new page's top-level
   * elements into view. With a fragment it did that to each of them in turn
   * and finished on <SiteHeader />, which is position: fixed and so is always
   * "in view" - the call that should have corrected the position did nothing,
   * and the page was left wherever scrolling the footer into view had put it.
   * Clicking REGISTER from the top of the home page landed two thirds of the
   * way down this page, in the middle of Meet the team.
   *
   * A single wrapper gives the router one element to scroll to, and its top
   * is the top of the page.
   */
  return (
    <div className="site-page">
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
                  {event.name.toUpperCase()}
                </h2>
                <p className={isMahalaya ? 'mahalaya-subtitle' : 'saraswati-subtitle'}>
                  ({event.category.toUpperCase()})
                </p>
              </div>

              <div className={isMahalaya ? 'mahalaya-timeline' : 'saraswati-timeline'}>
                {isMahalaya ? (
                  <>
                    <div className="mahalaya-timeline__item"><div className="mahalaya-timeline__dot"></div><strong className="mahalaya-timeline__title">Event Date</strong><span className="mahalaya-timeline__desc">{new Date(event.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
                    <div className="mahalaya-timeline__item">
                      <div className="mahalaya-timeline__dot"></div>
                      <strong className="mahalaya-timeline__title">Venue & Location</strong>
                      <span className="mahalaya-timeline__desc">
                        <span style={{ display: 'block', marginBottom: '4px' }}>
                          <strong>Breakfast:</strong> <a href="https://maps.app.goo.gl/giUCthuqRdgj53bd6?g_st=aw" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', color: 'inherit', textUnderlineOffset: '2px' }}>Lounge, Floor No: -1, Kohli Research Block (KCIS), IIIT Hyderabad</a>
                        </span>
                        <span style={{ display: 'block' }}>
                          <strong>Lunch:</strong> <a href="https://maps.app.goo.gl/E8wmSWJ1PDgBrSocA?g_st=aw" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', color: 'inherit', textUnderlineOffset: '2px' }}>North Mess, 1st Floor, Old Boys Hostel, IIIT Hyderabad</a>
                        </span>
                      </span>
                    </div>
                    <div className="mahalaya-timeline__item"><div className="mahalaya-timeline__dot"></div><strong className="mahalaya-timeline__title">Programme Schedule</strong>
                      <span className="mahalaya-timeline__desc">
                        <ol style={{ margin: '6px 0 0', paddingLeft: '1.2em', lineHeight: 1.8 }}>
                          <li><strong>Agomoni Path</strong> — 4:30 AM – 6:00 AM</li>
                          <li><strong>Agomoni r Dhwani</strong> (Cultural Programme) — 9:00 AM – 12:00 PM</li>
                          <li><strong>Breakfast</strong> <span style={{ opacity: 0.7, fontSize: '0.9em' }}>(optional · subject to prior registration)</span> — 8:00 AM – 11:00 AM</li>
                          <li><strong>Lunch</strong> <span style={{ opacity: 0.7, fontSize: '0.9em' }}>(optional · subject to prior registration)</span> — 1:00 PM – 4:00 PM</li>
                        </ol>
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="saraswati-timeline__item"><div className="saraswati-timeline__dot"></div><strong className="saraswati-timeline__title">Event Date</strong><span className="saraswati-timeline__desc">{new Date(event.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
                    <div className="saraswati-timeline__item"><div className="saraswati-timeline__dot"></div><strong className="saraswati-timeline__title">Venue</strong><span className="saraswati-timeline__desc">{event.venue}</span></div>
                    <div className="saraswati-timeline__item"><div className="saraswati-timeline__dot"></div><strong className="saraswati-timeline__title">About</strong><span className="saraswati-timeline__desc">{event.description}</span></div>
                  </>
                )}
              </div>

              <div className="events-extras-row">

                <MenuCardModal slug={event.slug} status={event.status} />
              </div>
            </div>

            <div className={`${isMahalaya ? 'mahalaya-card__formPane' : 'saraswati-card__formPane'}`} id="registration-form-container">
              {/* Without its coupon list: the form asks the server about one code
                  at a time, and the page payload is readable by anyone. */}
              <RegistrationForm event={stripCoupons(event)} />
            </div>
          </div>
        </section>

        {/* The people running the event, from public/data/team.csv. Renders
            nothing when that file is missing or empty, so an unfinished list
            leaves no gap. */}
        {/* {isMahalaya && <MeetTheTeam />} */}
      </main>

      <SiteFooter />
    </div>
  )
}
