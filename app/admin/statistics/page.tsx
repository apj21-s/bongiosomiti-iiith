import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminTier } from '@/utils/auth/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { getEvents } from '@/utils/data/events'
import {
  AUDIENCES,
  AUDIENCE_LABEL,
  breakdown,
  describePlates,
  paymentHistogram,
  registrationRows,
  type PaymentBar,
  type StatTicket,
} from '@/utils/data/statistics'

export const revalidate = 0

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

/**
 * Payment values against how often each was paid.
 *
 * Drawn here rather than charted with a library: it is one series of a dozen
 * bars at most, it has to render on the server with the rest of the page, and
 * a dependency that ships a canvas for this would be the heaviest thing on
 * the admin side by some margin.
 */
function PaymentPlot({ bars }: { bars: PaymentBar[] }) {
  if (bars.length === 0) {
    return <p className="text-muted" style={{ margin: 0 }}>No payments yet.</p>
  }

  const PAD_L = 44
  const PAD_R = 12
  const PAD_T = 22
  const PAD_B = 46
  const BAR = 46
  const GAP = 18
  const plotW = bars.length * BAR + (bars.length - 1) * GAP
  const plotH = 190
  const width = PAD_L + plotW + PAD_R
  const height = PAD_T + plotH + PAD_B

  const peak = Math.max(...bars.map((b) => b.count))
  // A round ceiling, so the gridlines fall on whole numbers of payments.
  const step = peak <= 4 ? 1 : peak <= 10 ? 2 : Math.ceil(peak / 5)
  const ceiling = Math.ceil(peak / step) * step
  const y = (count: number) => PAD_T + plotH - (count / ceiling) * plotH

  const ticks: number[] = []
  for (let t = 0; t <= ceiling; t += step) ticks.push(t)

  return (
    <div className="stats-plot">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img"
        aria-label={`Payment values and how many payments were made at each: ${bars.map((b) => `${b.count} at ${rupees(b.value)}`).join(', ')}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={width - PAD_R} y1={y(t)} y2={y(t)}
              stroke="#e2e8f0" strokeWidth={1} />
            <text x={PAD_L - 8} y={y(t) + 4} textAnchor="end"
              fontSize={11} fill="#a0aec0" fontFamily="inherit">{t}</text>
          </g>
        ))}

        {bars.map((bar, i) => {
          const x = PAD_L + i * (BAR + GAP)
          const top = y(bar.count)
          return (
            <g key={bar.value}>
              <rect x={x} y={top} width={BAR} height={PAD_T + plotH - top}
                rx={4} fill="#8F321F" opacity={0.86}>
                <title>{`${bar.count} payment${bar.count === 1 ? '' : 's'} of ${rupees(bar.value)} — ${rupees(bar.amount)}`}</title>
              </rect>
              <text x={x + BAR / 2} y={top - 6} textAnchor="middle"
                fontSize={12} fontWeight={700} fill="#2d3748" fontFamily="inherit">{bar.count}</text>
              <text x={x + BAR / 2} y={PAD_T + plotH + 18} textAnchor="middle"
                fontSize={11} fill="#4a5568" fontFamily="inherit">{rupees(bar.value)}</text>
              <text x={x + BAR / 2} y={PAD_T + plotH + 34} textAnchor="middle"
                fontSize={10} fill="#a0aec0" fontFamily="inherit">{rupees(bar.amount)}</text>
            </g>
          )
        })}

        <line x1={PAD_L} x2={width - PAD_R} y1={PAD_T + plotH} y2={PAD_T + plotH}
          stroke="#cbd5e0" strokeWidth={1} />
      </svg>
      <p className="stats-plot__key">
        Bar height is how many payments came to that amount; the figure under each
        bar is what those payments add up to.
      </p>
    </div>
  )
}

export default async function AdminStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>
}) {
  // The grid is every registration's money, across every collector. The API
  // routes check their own tier; this keeps the page itself out of the way.
  const tier = await getAdminTier()
  if (tier < 3) redirect('/admin')

  const { event: wanted } = await searchParams
  const supabase = await createServiceRoleClient()
  const events = await getEvents()

  const { data: allTickets } = await supabase
    .from('tickets')
    .select('token, participant_name, email, is_iiit, food_pref, amount, payment_status, event_id')

  const tickets = (allTickets || []) as (StatTicket & { payment_status?: string; event_id?: string })[]

  // Default to whichever event people have actually booked, so the page opens
  // on something rather than on an empty grid.
  const ticketsPerEvent = new Map<string, number>()
  for (const t of tickets) {
    if (t.event_id) ticketsPerEvent.set(t.event_id, (ticketsPerEvent.get(t.event_id) ?? 0) + 1)
  }
  const busiest = [...ticketsPerEvent.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const event =
    events.find((e: any) => e.slug === wanted) ||
    events.find((e: any) => e.id === busiest) ||
    events[0]

  if (!event) {
    return (
      <main className="admin-page-content">
        <h1 style={{ fontSize: '2rem', margin: 0 }}>Statistics</h1>
        <p className="text-muted">No events are configured yet.</p>
      </main>
    )
  }

  const mine = tickets.filter((t) => t.event_id === event.id)
  const approved = mine.filter((t) => t.payment_status === 'APPROVED')
  const pending = mine.filter((t) => t.payment_status === 'PENDING')

  const grid = breakdown(event, approved)
  const pendingGrid = breakdown(event, pending)
  const bars = paymentHistogram(approved)
  // The plates behind each payment, in the order the event offers them.
  const bookings = registrationRows(approved, grid.plates)
  const registrations = bars.reduce((sum, b) => sum + b.count, 0)

  return (
    <main className="admin-page-content" data-admin-statistics>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <p className="section-label" style={{ marginBottom: '8px' }}>Reporting</p>
          <h1 style={{ fontSize: '2rem', margin: 0, lineHeight: 1.2, letterSpacing: '-0.03em', color: '#1a202c' }}>Statistics</h1>
          <p style={{ margin: '8px 0 0', color: '#718096', maxWidth: '760px' }}>
            Every approved payment for <strong>{event.name}</strong>, by the rate it was
            charged at and the plate it bought.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {events.length > 1 && events.map((e: any) => (
            <Link key={e.slug} href={`/admin/statistics?event=${e.slug}`}
              className={`btn ${e.slug === event.slug ? 'btn-primary' : 'btn-secondary'}`}>
              {e.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="admin-stats-row">
        <div className="admin-stat-card">
          <span className="admin-stat-label">Registrations</span>
          <div className="admin-stat-value">{registrations}</div>
          <span className="admin-stat-desc">Paid and approved</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-label">Plates</span>
          <div className="admin-stat-value">{grid.total.passes}</div>
          <span className="admin-stat-desc">Passes issued</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-label">Collected</span>
          <div className="admin-stat-value">{rupees(grid.total.amount)}</div>
          <span className="admin-stat-desc">After any discount</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-label">Awaiting approval</span>
          <div className="admin-stat-value">{pendingGrid.total.passes}</div>
          <span className="admin-stat-desc">
            {pendingGrid.total.passes > 0 ? `${rupees(pendingGrid.total.amount)} not counted below` : 'Nothing pending'}
          </span>
        </div>
      </div>

      <section className="admin-section-card">
        <h3 style={{ marginTop: 0 }}>Who bought what</h3>
        <p className="text-muted" style={{ marginTop: 0 }}>
          Plates in each cell, and what they came to. <strong>Members</strong> is the
          staff rate &mdash; an institute address that is not a <code>students</code> or{' '}
          <code>research</code> one; the event editor calls the same column &ldquo;Staff&nbsp;₹&rdquo;.
        </p>

        <div className="table-responsive">
          <table className="data-table admin-stack-table stats-grid">
            <thead>
              <tr>
                <th></th>
                {grid.plates.map((plate) => <th key={plate}>{plate}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {AUDIENCES.map((audience) => (
                <tr key={audience}>
                  <th scope="row" data-label="">{AUDIENCE_LABEL[audience]}</th>
                  {grid.plates.map((plate) => {
                    const cell = grid.cells[audience][plate]
                    return (
                      <td key={plate} data-label={plate}>
                        {cell ? (
                          <span className="stats-cell">
                            <strong>{cell.passes}</strong>
                            <span className="stats-cell__money">{rupees(cell.amount)}</span>
                          </span>
                        ) : <span className="stats-cell__zero">—</span>}
                      </td>
                    )
                  })}
                  <td data-label="Total">
                    <span className="stats-cell">
                      <strong>{grid.byAudience[audience].passes}</strong>
                      <span className="stats-cell__money">{rupees(grid.byAudience[audience].amount)}</span>
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="stats-grid__totals">
                <th scope="row" data-label="">Total</th>
                {grid.plates.map((plate) => (
                  <td key={plate} data-label={plate}>
                    <span className="stats-cell">
                      <strong>{grid.byPlate[plate].passes}</strong>
                      <span className="stats-cell__money">{rupees(grid.byPlate[plate].amount)}</span>
                    </span>
                  </td>
                ))}
                <td data-label="Total">
                  <span className="stats-cell">
                    <strong>{grid.total.passes}</strong>
                    <span className="stats-cell__money">{rupees(grid.total.amount)}</span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {grid.retired.length > 0 && (
          <p className="text-muted" style={{ marginBottom: 0 }}>
            {grid.retired.join(', ')} {grid.retired.length === 1 ? 'is a plate' : 'are plates'}{' '}
            the event no longer offers. Those passes are kept in the grid so the
            totals match the money taken.
          </p>
        )}
        {grid.unplated.passes > 0 && (
          <p className="text-muted" style={{ marginBottom: 0 }}>
            {grid.unplated.passes} pass{grid.unplated.passes === 1 ? '' : 'es'} carry no
            plate at all &mdash; booked before the meal sections existed. They are in
            the row totals but in no column.
          </p>
        )}
      </section>

      <section className="admin-section-card">
        <h3 style={{ marginTop: 0 }}>What people paid</h3>
        <p className="text-muted" style={{ marginTop: 0 }}>
          One payment per registration, not per plate: a booking of three plates is
          one amount paid once.
        </p>
        <PaymentPlot bars={bars} />
      </section>

      <section className="admin-section-card">
        <h3 style={{ marginTop: 0 }}>Every booking</h3>
        <p className="text-muted" style={{ marginTop: 0 }}>
          What each payment was actually made up of. The chart above says how many
          payments came to a figure; this says which plates that figure was.
        </p>

        {bookings.length === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>No approved bookings yet.</p>
        ) : (
          <div className="table-responsive">
            <table className="data-table admin-stack-table">
              <thead>
                <tr>
                  <th>Participant</th><th>Rate</th><th>Plates</th><th>Passes</th><th>Paid</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td data-label="Participant">
                      <strong>{booking.participantName}</strong>
                      {booking.email ? <span className="stats-booking__sub">{booking.email}</span> : null}
                    </td>
                    <td data-label="Rate">{AUDIENCE_LABEL[booking.audience]}</td>
                    <td data-label="Plates">{describePlates(booking)}</td>
                    <td data-label="Passes">{booking.passes}</td>
                    <td data-label="Paid">{rupees(booking.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
