import Link from 'next/link'
import LogoutButton from './LogoutButton'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <header className="home-strip">
        <div className="home-strip__inner">
          <Link className="home-strip__brand" href="/admin">BANGIYA.SAMITI &bull; ADMIN</Link>
          <nav className="home-strip__nav" aria-label="Admin Navigation">
            <Link className="home-strip__link" href="/">WEBSITE</Link>
            <Link className="home-strip__link" href="/admin">DASHBOARD</Link>
            <Link className="home-strip__link" href="/admin/events">EVENTS</Link>
            <Link className="home-strip__link" href="/admin/registrations">REGISTRATIONS</Link>
            <Link className="home-strip__link" href="/admin/payments">PAYMENTS</Link>
            <Link className="home-strip__link" href="/admin/scanner">SCANNER</Link>
            <Link className="home-strip__link" href="/admin/check-ins">CHECK-INS</Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      {children}
    </>
  )
}
