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
                    src="/assets/footer-banner.webp"
                    alt="BANGIYA.SAMITI.IIITH Bengali Cultural Alpona & Lotus Motif"
                    width="1024"
                    height="136"
                    loading="lazy"
                    decoding="async"
                />
            </div>
            <div className="utsav-footer__content">
                <div className="utsav-footer__grid">
                    {/* Col 1: Identity */}
                    <div className="utsav-footer__brandCol">
                        <div className="utsav-footer__brand">
                            <img className="utsav-footer__emblem" src="/assets/logo.png" alt="বঙ্গীয়.SAMITI Emblem" />
                            <span className="utsav-footer__logo">বঙ্গীয়.SAMITI{variant === 'admin' ? ' \u2022 ADMIN' : ''}</span>
                            <span className="utsav-footer__bengali">আইআইআইটি বঙ্গীয় সমিতি</span>
                        </div>
                        <p className="utsav-footer__about">
                            {variant === 'admin'
                                ? 'IIIT Hyderabad Bangiya Samiti Internal Organiser & Verification Suite.'
                                : "IIIT Hyderabad Bangiya Samiti's digital pass & cultural festivity portal."}
                        </p>
                    </div>

                    {/* Col 2: Navigation */}
                    <div className="utsav-footer__navCol">
                        <h3 className="utsav-footer__title">Quick Navigation</h3>
                        <ul className="utsav-footer__links">
                            {variant === 'admin' ? (
                                <>
                                    <li><Link href="/">Home</Link></li>
                                    <li><Link href="/#events">Events Catalog</Link></li>
                                </>
                            ) : (
                                <>
                                    <li><Link href="/">Home</Link></li>
                                    <li><Link href="/#events">Events Catalog</Link></li>
                                </>
                            )}
                        </ul>
                    </div>

                    {/* Col 3: Events */}
                    <div className="utsav-footer__navCol">
                        <h3 className="utsav-footer__title">Festivals & Feasts</h3>
                        <ul className="utsav-footer__links">
                            <li><Link href="/events/mahalaya">Mahalaya Bhoj 2026</Link></li>
                            <li><Link href="/events/saraswati">Saraswati Puja 2027</Link></li>
                        </ul>
                    </div>

                    {/* Col 4: Contact & Venue */}
                    <div className="utsav-footer__navCol">
                        <h3 className="utsav-footer__title">Contact & Location</h3>
                        <div className="utsav-footer__contact">
                            <p>📍 <a href="https://maps.app.goo.gl/DJQVksxmKAVi3aRJ9">IIIT Hyderabad, Gachibowli, Hyderabad 500032</a></p>
                            <p>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M2 10v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V10L12 4Z" />
                                    <rect x="6" y="2" width="12" height="10" rx="1.5" />
                                    <circle cx="12" cy="7" r="1.2" />
                                    <path d="M13.2 7v0.8a1.2 1.2 0 0 0 2.4 0V7a3.6 3.6 0 1 0-3.6 3.6h0.5" />
                                    <path d="M2 12v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8L12 15Z" />
                                </svg>{' '}
                                <a href="mailto:bangiya.samiti.iiith@gmail.com">bangiya.samiti.iiith@gmail.com</a>
                            </p>
                            <p>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                                </svg>{' '}
                                <a href="https://www.instagram.com/bongiyo.samiti.iiith" target="_blank" rel="noopener noreferrer">bangiya.samiti.iiith</a>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="utsav-footer__bottom">
                    <p className="utsav-footer__copyright">
                        &copy; 2026 IIIT Bangiya Samiti &bull; {variant === 'admin' ? 'Protected Internal Organiser Area' : 'All Rights Reserved'} {variant !== 'admin' && (
                            <>
                                &bull; By <a href="https://github.com/apj21-s">arco</a> & <a href="https://github.com/sagarjha7174">sagar</a>
                            </>
                        )}
                    </p>
                    <p className="utsav-footer__quote">
                        <span className="utsav-footer__quote-part">বারো মাসে তেরো পার্বণ, এটাই তো খাঁটি বাঙালি জীবন</span>
                        <span className="utsav-footer__quote-separator" aria-hidden="true">||</span>
                        <span className="utsav-footer__quote-part">বাঙালি শুধু একটা জাতি নয়, বাঙালি একটা আবেগ</span>
                    </p>
                </div>
            </div>
        </footer>
    )
}
