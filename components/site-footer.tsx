import Link from 'next/link'

type SiteFooterProps = {
  variant?: 'public' | 'admin'
}

export default function SiteFooter({ variant = 'public' }: SiteFooterProps) {
  return (
    <footer className="utsav-footer" role="contentinfo">
      <div className="utsav-footer__banner">
        <img
          className="utsav-footer__bannerImage"
          src="/assets/footer-banner.png"
          alt="BANGIYA.SAMITI.IIITH Bengali Cultural Alpona & Lotus Motif"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="utsav-footer__content">
        <div className="utsav-footer__grid">
          <div className="utsav-footer__brandCol">
            <div className="utsav-footer__brand">
              <span className="utsav-footer__logo">BANGIYA.SAMITI{variant === 'admin' ? ' &bull; ADMIN' : ''}</span>
              <span className="utsav-footer__bengali">আইআইআইটি বঙ্গীয় সমিতি</span>
            </div>
            <p className="utsav-footer__about">
              {variant === 'admin'
                ? 'IIIT Hyderabad Bongio Samiti Internal Organiser & Verification Suite.'
                : "IIIT Hyderabad Bongio Samiti's digital pass & cultural festivity portal."}
            </p>
          </div>

          <div className="utsav-footer__navCol">
            <h4 className="utsav-footer__title">{variant === 'admin' ? 'Admin Suite' : 'Quick Navigation'}</h4>
            <ul className="utsav-footer__links">
              {variant === 'admin' ? (
                <>
                  <li><Link href="/admin">Dashboard</Link></li>
                  <li><Link href="/admin/registrations">Registrations</Link></li>
                  <li><Link href="/admin/payments">Payments</Link></li>
                  <li><Link href="/admin/scanner">Gate Scanner</Link></li>
                </>
              ) : (
                <>
                  <li><Link href="/">Home</Link></li>
                  <li><Link href="/events">Events Catalog</Link></li>
                  <li><Link href="/pass">Payment Status</Link></li>
                </>
              )}
            </ul>
          </div>

          <div className="utsav-footer__navCol">
            <h4 className="utsav-footer__title">{variant === 'admin' ? 'Public Website' : 'Festivals & Feasts'}</h4>
            <ul className="utsav-footer__links">
              {variant === 'admin' ? (
                <>
                  <li><Link href="/">Public Home</Link></li>
                  <li><Link href="/events">Events Catalog</Link></li>
                  <li><Link href="/pass">Check Payment Status</Link></li>
                </>
              ) : (
                <>
                  <li><Link href="/events/mahalaya">Mahalaya Bhoj 2026</Link></li>
                  <li><Link href="/events/saraswati">Saraswati Puja 2027</Link></li>
                </>
              )}
            </ul>
          </div>

          <div className="utsav-footer__navCol">
            <h4 className="utsav-footer__title">{variant === 'admin' ? 'Internal Support' : 'Contact & Location'}</h4>
            <div className="utsav-footer__contact">
              <p>📍 <a href="https://maps.app.goo.gl/DJQVksxmKAVi3aRJ9">IIIT Hyderabad, Gachibowli, Hyderabad 500032</a></p>
              <p>✉️ <a href="mailto:bangiya.samiti.iith@gmail.com">bangiya.samiti.iith@gmail.com</a></p>
              <p>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>{' '}
                <a href="https://www.instagram.com/bongiyo.samiti.iiith" target="_blank" rel="noopener noreferrer">bongiyo.samiti.iiith</a>
              </p>
            </div>
          </div>
        </div>

        <div className="utsav-footer__bottom">
          <p className="utsav-footer__copyright">
            &copy; 2026 IIIT Bongio Samiti &bull; {variant === 'admin' ? 'Protected Internal Organiser Area' : 'All Rights Reserved'}
          </p>
          {variant !== 'admin' && (
            <p className="utsav-footer__quote">
              বারো মাসে তেরো পার্বণ, এটাই তো খাঁটি বাঙালি জীবন   ||   বাঙালি শুধু একটা জাতি নয়, বাঙালি একটা আবেগ
            </p>
          )}
          <div className="utsav-footer__bottomLinks">
            <Link href="/#top">Back to top &uarr;</Link>
            <span>&bull;</span>
            <Link href={variant === 'admin' ? '/admin' : '/events'}>All Events</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
