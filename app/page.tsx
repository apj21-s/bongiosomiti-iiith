import Link from 'next/link'
import { staticEvents } from '@/utils/data/events'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import PhotoAlbum from '@/components/photo-album'
import CrossfadeVideo from '@/components/crossfade-video'
import HeroBirdsAnimator from '@/components/hero-birds-animator'

export const revalidate = 0

export default async function Home() {
  const activeEvents = staticEvents.filter(e => e.status === 'OPEN').sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())

  return (
    <main id="top" className="home-page">
      <SiteHeader />

      <section className="home-banner" aria-hidden="true">
        <div className="home-banner__scene">
          <div className="home-banner__layer home-banner__layer--left">
            <img className="home-banner__image home-banner__image--left" src="/assets/autumn-landscape.webp" alt="" width={1792} height={592} fetchPriority="high" loading="eager" decoding="async" />
          </div>
          <div className="home-banner__layer home-banner__layer--center">
            <img className="home-banner__image home-banner__image--center" src="/assets/kolkata-street.webp" alt="" width={1792} height={592} loading="lazy" decoding="async" />
          </div>
          <div className="home-banner__layer home-banner__layer--right">
            <img className="home-banner__image home-banner__image--right" src="/assets/community-puja.webp" alt="" width={1200} height={880} loading="lazy" decoding="async" />
          </div>
        </div>
        <div className="home-banner__blend"></div>
      </section>

      <section id="home" className="home-hero" aria-labelledby="home-hero-title">
        <div className="home-hero__scene" aria-hidden="true">
          <div className="home-hero__layer home-hero__layer--landscape">
            <img className="home-hero__image home-hero__image--landscape" src="/assets/autumn-landscape.webp" alt="" width={1792} height={592} fetchPriority="high" loading="eager" decoding="async" />
          </div>

          <div className="home-hero__sun-glow">
            <div className="sun-corona"></div>
            <div className="sun-flare"></div>
            <div className="sun-rays"></div>
          </div>

          <div className="home-hero__birds-sky">
            <div className="hero-bird-flock flock-1">
              <div className="hero-bird bird-lead">
                <svg className="bird-svg" viewBox="0 0 32 18">
                  <path className="bird-wing-left" d="M16 12 C10 4, 3 3, 0 6 C5 12, 12 13, 16 12 Z" fill="#3c2618" />
                  <path className="bird-wing-right" d="M16 12 C22 4, 29 3, 32 6 C27 12, 20 13, 16 12 Z" fill="#3c2618" />
                  <path className="bird-body" d="M13 11 C15 10, 18 10, 20 12 C17 14, 15 14, 13 11 Z" fill="#28180e" />
                </svg>
              </div>
              <div className="hero-bird bird-wingman-1">
                <svg className="bird-svg" viewBox="0 0 32 18">
                  <path className="bird-wing-left" d="M16 12 C10 4, 3 3, 0 6 C5 12, 12 13, 16 12 Z" fill="#442c1d" />
                  <path className="bird-wing-right" d="M16 12 C22 4, 29 3, 32 6 C27 12, 20 13, 16 12 Z" fill="#442c1d" />
                  <path className="bird-body" d="M13 11 C15 10, 18 10, 20 12 C17 14, 15 14, 13 11 Z" fill="#28180e" />
                </svg>
              </div>
              <div className="hero-bird bird-wingman-2">
                <svg className="bird-svg" viewBox="0 0 32 18">
                  <path className="bird-wing-left" d="M16 12 C10 4, 3 3, 0 6 C5 12, 12 13, 16 12 Z" fill="#4d3322" />
                  <path className="bird-wing-right" d="M16 12 C22 4, 29 3, 32 6 C27 12, 20 13, 16 12 Z" fill="#4d3322" />
                  <path className="bird-body" d="M13 11 C15 10, 18 10, 20 12 C17 14, 15 14, 13 11 Z" fill="#28180e" />
                </svg>
              </div>
            </div>

            <div className="hero-bird-flock flock-2">
              <div className="hero-bird bird-lead">
                <svg className="bird-svg" viewBox="0 0 32 18">
                  <path className="bird-wing-left" d="M16 12 C10 4, 3 3, 0 6 C5 12, 12 13, 16 12 Z" fill="#523826" />
                  <path className="bird-wing-right" d="M16 12 C22 4, 29 3, 32 6 C27 12, 20 13, 16 12 Z" fill="#523826" />
                  <path className="bird-body" d="M13 11 C15 10, 18 10, 20 12 C17 14, 15 14, 13 11 Z" fill="#28180e" />
                </svg>
              </div>
              <div className="hero-bird bird-wingman-1">
                <svg className="bird-svg" viewBox="0 0 32 18">
                  <path className="bird-wing-left" d="M16 12 C10 4, 3 3, 0 6 C5 12, 12 13, 16 12 Z" fill="#5a3d2a" />
                  <path className="bird-wing-right" d="M16 12 C22 4, 29 3, 32 6 C27 12, 20 13, 16 12 Z" fill="#5a3d2a" />
                  <path className="bird-body" d="M13 11 C15 10, 18 10, 20 12 C17 14, 15 14, 13 11 Z" fill="#28180e" />
                </svg>
              </div>
            </div>

            <div className="hero-bird hero-bird-solo">
              <svg className="bird-svg" viewBox="0 0 32 18">
                <path className="bird-wing-left" d="M16 12 C10 4, 3 3, 0 6 C5 12, 12 13, 16 12 Z" fill="#3c2618" />
                <path className="bird-wing-right" d="M16 12 C22 4, 29 3, 32 6 C27 12, 20 13, 16 12 Z" fill="#3c2618" />
                <path className="bird-body" d="M13 11 C15 10, 18 10, 20 12 C17 14, 15 14, 13 11 Z" fill="#28180e" />
              </svg>
            </div>
            
            {/* Landing bird animation element */}
            <div className="hero-landing-bird" aria-hidden="true">
              <svg className="bird-svg" viewBox="0 0 32 18">
                <path className="bird-wing-left" d="M16 12 C10 4, 3 3, 0 6 C5 12, 12 13, 16 12 Z" fill="#3c2618" />
                <path className="bird-wing-right" d="M16 12 C22 4, 29 3, 32 6 C27 12, 20 13, 16 12 Z" fill="#3c2618" />
                <path className="bird-body" d="M13 11 C15 10, 18 10, 20 12 C17 14, 15 14, 13 11 Z" fill="#28180e" />
              </svg>
            </div>
            
            {/* Invisible anchor at the man's right shoulder in the autumn landscape */}
            <div className="hero-shoulder-perch" aria-hidden="true"></div>
          </div>
        </div>

        <div className="home-hero__content scroll-reveal">
          <h1 id="home-hero-title" className="home-hero__title">
            <span className="hero-char hero-char-b">B</span>
            <span className="hero-char hero-char-a1">A</span>
            <span className="hero-char hero-char-n">N</span>
            <span className="hero-char hero-char-g">G</span>
            <span className="hero-char hero-char-i">I</span>
            <span className="hero-char hero-char-y">Y</span>
            <span className="hero-char hero-char-a2">A</span>
            <span className="hero-char hero-char-dot">.</span>
            <span className="hero-char hero-char-s">S</span>
            <span className="hero-char hero-char-a3">A</span>
            <span className="hero-char hero-char-m">M</span>
            <span className="hero-char hero-char-i2">I</span>
            <span className="hero-char hero-char-t">T</span>
            <span className="hero-char hero-char-i3">I</span>
          </h1>
          <p className="home-hero__subtitle">IIIT HYDERABAD</p>
          <div className="home-hero__card">
            <p><span className="hero-tag-flourish">❖</span> আড্ডা হোক, বাংলা হোক <span className="hero-tag-flourish">❖</span></p>
          </div>
        </div>
        <HeroBirdsAnimator />
      </section>

      <section id="events" className="events-page" aria-labelledby="events-title">
        <div className="events-scene">
          <div className="events-scene__panel">
            <div className="events-scene__hero scroll-reveal scroll-reveal--delay-1" id="events-hero-player">
              <img className="events-scene__hero-image events-scene__hero-poster" src="/assets/community-puja.webp" alt="Bengali Puja Courtyard Celebration" width={1200} height={880} loading="lazy" decoding="async" />
              <CrossfadeVideo />
            </div>

            <div className="story-card__intro scroll-reveal" style={{ padding: '0 clamp(16px, 4vw, 48px)' }}>
              <div className="story-card__introMeta">
                <p className="section-label">আমাদের উৎসব</p>
              </div>
              <h2 id="events-title">Our Community, Our Festivities</h2>
            </div>

            <div className="events-scene__cards">
              {activeEvents.map((event: any, i: number) => (
                <Link
                  className="events-scene__card scroll-reveal"
                  style={{ animationDelay: `${i * 2}s` }}
                  href={`/events/${event.slug}#registration-form-container`}
                  key={event.id}
                  aria-label={`Register for ${event.name}`}
                >
                  <div className="events-scene__card-media">
                    <img
                      className="events-scene__card-image"
                      src={event.image_url || (event.slug === 'mahalaya' ? '/assets/mahalaya-bhoj.webp' : '/assets/saraswati-puja.webp')}
                      alt={event.name}
                      width={event.slug === 'mahalaya' ? 1264 : 544}
                      height={event.slug === 'mahalaya' ? 848 : 880}
                      loading="lazy"
                      decoding="async"
                      style={{ objectPosition: event.slug === 'mahalaya' ? 'center 36%' : 'center 20%' }}
                    />
                    <span className="events-scene__card-badge">
                      {event.price === 0 ? 'Campus Celebration' : 'Limited Pass Availability'}
                    </span>
                  </div>
                  <div className="events-scene__card-body">
                    <div className="events-scene__card-meta">
                      <span className="events-scene__card-date">
                        {new Date(event.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                      </span>
                      <span className="events-scene__card-tag">{event.tag}</span>
                    </div>
                    <h3 className="events-scene__card-title">{event.name}</h3>
                    <p className="events-scene__card-desc">{event.description}</p>
                    <div className="events-scene__card-footer">
                      <span className="events-scene__card-invitation">
                        {event.price === 0 
                          ? '✨ Join the celebration • Free Entry'
                          : `⚡ Seats are limited • ₹${event.price}+ onwards / pass`}
                      </span>
                      <span className="events-scene__card-btn">
                        <span>REGISTER NOW</span>
                        <span className="events-scene__card-arrow">&rarr;</span>
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="story" className="story-page" aria-labelledby="story-title">
        <article className="story-card">
          <div className="story-card__intro scroll-reveal">
            <div className="story-card__introMeta">
              <p className="section-label">আমাদের গল্প</p>
            </div>
            <h2 id="story-title">A curated memory archive</h2>
          </div>

          <div className="story-card__header scroll-reveal scroll-reveal--delay-1">
            <img className="story-card__headerImage" src="/assets/amader-golpo.webp" alt="Bangiya Samiti Story Illustration" width={1536} height={660} loading="lazy" decoding="async" />
            <div className="story-card__sunbeam" aria-hidden="true"></div>
            <div className="story-card__headerOverlay" aria-hidden="true"></div>
            <div className="story-card__headerCopy">
              <p className="section-label">আমাদের গল্প</p>
              <h2>Our story</h2>
              <p>Real moments from Bengali community events, gathered in one editable archive.</p>
            </div>
          </div>

          <div className="story-card__body">
            <PhotoAlbum />
          </div>
        </article>
      </section>

      <SiteFooter />
    </main>
  )
}
