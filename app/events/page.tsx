import Link from 'next/link'
import { getEvents } from '@/utils/data/events'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import CrossfadeVideo from '@/components/crossfade-video'

export const revalidate = 0

export default async function EventsPage() {
  const activeEvents = getEvents().sort((a: any, b: any) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())

  return (
    <main className="events-page" style={{ paddingTop: '1.5rem' }}>
      <SiteHeader />

      <section className="events-scene" aria-labelledby="events-scene-title">
        <div className="events-scene__label-row">
          <p className="events-scene__eyebrow" id="events-scene-title">Courtyard &amp; Community Gatherings</p>
          <Link href="/" className="events-scene__backlink">&larr; Back to Home</Link>
        </div>

        <div className="events-scene__panel">
          <div className="events-scene__hero" id="events-hero-player">
            <img className="events-scene__hero-image events-scene__hero-poster" src="/assets/puja-poster.webp" alt="Bengali Puja Courtyard Celebration" width={1200} height={880} loading="lazy" decoding="async" />
            <CrossfadeVideo />
          </div>

          <div className="events-scene__copy" style={{ padding: '1rem 0 0.5rem' }}>
            <p className="section-label">Campus &amp; Community Catalog</p>
            <h1 style={{ margin: '0.25rem 0 0.5rem', fontSize: '2rem' }}>Celebrate Heritage With Us</h1>
            <p className="events-scene__lede">Choose an event below to reserve your digital pass, enjoy authentic feasts, and join communal rituals.</p>
          </div>

          <div id="public-events-catalog" className="events-scene__cards">
            {activeEvents.map((event: any) => (
              <Link href={`/events/${event.slug}`} className="events-scene__card" key={event.id}>
                <div className="events-scene__card-media">
                  <img
                    className="events-scene__card-image"
                    src={event.image_url?.startsWith('/') ? event.image_url : `/assets/${event.image_url?.replace(/^assets\//, '') || 'community-puja.webp'}`}
                    alt={event.name}
                  />
                </div>
                <div className="events-scene__card-body">
                  <div className="events-scene__card-meta">
                    <span>{new Date(event.event_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    <span>{event.category}</span>
                  </div>
                  <h3 className="events-scene__card-title">{event.name}</h3>
                  <p>{event.description?.replace('Shared tables, smoke, brass, and a warm autumn gathering built around authentic Bengali food, adda, and ritual warmth.', 'Bengali food • Adda • Celebration').replace('A serene campus procession with fresh yellow flowers, alpona, morning anjali, recitation, music, and student gathering.', 'Yellow blooms • Anjali • Music • Culture')}</p>
                  <span className="events-scene__card-link">{event.status === 'OPEN' ? 'REGISTER NOW' : 'COMING SOON'}</span>
                </div>
              </Link>
            ))}
          </div>

          <p className="events-scene__caption">
            IIIT BANGIYA SAMITI &bull; CULTURAL HERITAGE IN DIGITAL FORM
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
