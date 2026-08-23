import Link from 'next/link'

type SiteHeaderProps = {
  variant?: 'public' | 'admin'
}

export default function SiteHeader({ variant = 'public' }: SiteHeaderProps) {
  if (variant === 'admin') {
    return (
      <header className="home-strip">
        <div className="home-strip__inner">
          <Link className="home-strip__brand" href="/">BANGIYA.SAMITI &bull; ADMIN</Link>
          <nav className="home-strip__nav" aria-label="Admin Navigation">
            <Link className="home-strip__link" href="/">WEBSITE</Link>
            <Link className="home-strip__link" href="/admin">DASHBOARD</Link>
            <Link className="home-strip__link" href="/admin/events">EVENTS</Link>
            <Link className="home-strip__link" href="/admin/registrations">REGISTRATIONS</Link>
            <Link className="home-strip__link" href="/admin/payments">PAYMENTS</Link>
            <Link className="home-strip__link" href="/admin/scanner">SCANNER</Link>
            <Link className="home-strip__link" href="/admin/check-ins">CHECK-INS</Link>
          </nav>
          <Link className="home-strip__action" href="/admin/login">SIGN OUT</Link>
        </div>
      </header>
    )
  }

  return (
    <header className="home-strip">
      <div className="home-strip__inner">
        <Link className="home-strip__brand" href="/">BANGIYA.SAMITI</Link>
        <nav className="home-strip__nav" aria-label="Primary">
          <Link className="home-strip__link" href="/#home" aria-current="page">HOME</Link>
          <Link className="home-strip__link" href="/#events">EVENTS</Link>
          <Link className="home-strip__link" href="/#story">STORY</Link>
          <Link className="home-strip__link" href="/pass">PAYMENT STATUS</Link>
        </nav>
        <Link className="home-strip__action" href="/events/mahalaya">REGISTER</Link>
      </div>
    </header>
  )
}
