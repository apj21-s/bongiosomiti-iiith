'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
// The same wording and the same shape the register route resolves against.
import { describeCoupon, type Coupon, type CouponKind } from '@/utils/coupons'
import { confirmAction, notifyError, notifySuccess } from '@/components/site-notifications'

type Row = Coupon & { uses: number | null }

type EventCoupons = {
  slug: string
  name: string
  status: string | null
  eventDate: string | null
  /** Null when the tickets could not be read. */
  registrations: number | null
  coupons: Row[]
}

/**
 * The form holds strings, because that is what inputs hold, and a checkbox
 * per condition, because "no threshold" and "a threshold of 0" are different
 * settings and a blank box cannot tell them apart.
 */
type FormState = {
  eventSlug: string
  code: string
  kind: CouponKind
  value: string
  maxDiscount: string
  useThreshold: boolean
  minSubtotal: string
  useFirstN: boolean
  firstN: string
  active: boolean
}

const emptyForm = (eventSlug = ''): FormState => ({
  eventSlug,
  code: '',
  kind: 'fixed',
  value: '',
  maxDiscount: '',
  useThreshold: false,
  minSubtotal: '0',
  useFirstN: false,
  firstN: '',
  active: true,
})

const amountOf = (c: Coupon) => (c.value !== undefined && c.value !== null ? c.value : (c.discount ?? 0))

function fromCoupon(eventSlug: string, c: Coupon): FormState {
  return {
    eventSlug,
    code: c.code,
    kind: c.kind === 'percent' ? 'percent' : 'fixed',
    value: String(amountOf(c)),
    maxDiscount: c.maxDiscount != null ? String(c.maxDiscount) : '',
    useThreshold: c.minSubtotal != null,
    minSubtotal: c.minSubtotal != null ? String(c.minSubtotal) : '0',
    useFirstN: c.firstN != null,
    firstN: c.firstN != null ? String(c.firstN) : '',
    active: c.active !== false,
  }
}

/** What is sent. The server validates it again with the same rules. */
function toCoupon(form: FormState): Coupon {
  return {
    code: form.code.trim().toUpperCase(),
    kind: form.kind,
    value: Number(form.value),
    maxDiscount: form.kind === 'percent' && form.maxDiscount.trim() !== '' ? Number(form.maxDiscount) : null,
    minSubtotal: form.useThreshold ? Number(form.minSubtotal || 0) : null,
    firstN: form.useFirstN ? Number(form.firstN) : null,
    active: form.active,
  }
}

/** Where a first-N coupon stands, in words. Null when it has no such limit. */
function earlyStanding(c: Coupon, registrations: number | null): string | null {
  if (c.firstN == null) return null
  if (registrations === null) return `First ${c.firstN} registrations — count unavailable`
  if (registrations < c.firstN) return `${registrations} of the first ${c.firstN} registrations taken`
  return c.minSubtotal != null
    ? `First ${c.firstN} reached — now only the basket threshold applies`
    : `First ${c.firstN} reached — no longer applies`
}

const url = (slug: string, code: string) =>
  `/api/admin/coupons/${encodeURIComponent(slug)}/${encodeURIComponent(code)}`

export default function CouponsClient() {
  const [events, setEvents] = useState<EventCoupons[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  // The coupon being edited, by where it lives. Null means the form adds.
  const [editing, setEditing] = useState<{ slug: string; code: string } | null>(null)
  const formRef = useRef<HTMLElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/coupons')
      const data = await res.json()
      if (!res.ok || !Array.isArray(data)) throw new Error(data?.error || 'Could not load coupons')
      setEvents(data)
      setLoadError(null)
      // /admin/coupons#<slug>, as linked from the event editor, starts the
      // form on that event; otherwise on the first one.
      const wanted = decodeURIComponent(window.location.hash.replace(/^#/, ''))
      setForm((f) => (f.eventSlug ? f : { ...f, eventSlug: data.some((e: EventCoupons) => e.slug === wanted) ? wanted : (data[0]?.slug ?? '') }))
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load coupons')
    } finally {
      setLoading(false)
    }
  }, [])

  // Started without touching state synchronously, so the first render is the
  // loading state rather than an effect that sets it.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (cancelled) return
      await load()
    })()
    return () => { cancelled = true }
  }, [load])

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  function startEdit(slug: string, c: Coupon) {
    setEditing({ slug, code: c.code })
    setForm(fromCoupon(slug, c))
    setFormError(null)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function cancelEdit() {
    setEditing(null)
    setForm((f) => emptyForm(f.eventSlug))
    setFormError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSaving(true)
    try {
      const coupon = toCoupon(form)
      const res = editing
        ? await fetch(url(editing.slug, editing.code), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coupon }),
          })
        : await fetch('/api/admin/coupons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventSlug: form.eventSlug, coupon }),
          })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save the coupon')

      notifySuccess(editing ? `${data.code} saved.` : `${data.code} added.`)
      setEditing(null)
      setForm((f) => emptyForm(f.eventSlug))
      await load()
    } catch (err) {
      // Shown beside the form as well as raised, since the mistake is usually
      // in one of its boxes and a toast is gone before it is read.
      setFormError(err instanceof Error ? err.message : 'Could not save the coupon')
    } finally {
      setSaving(false)
    }
  }

  async function toggle(slug: string, c: Row) {
    const { uses: _uses, ...coupon } = c
    void _uses
    try {
      const res = await fetch(url(slug, c.code), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coupon: { ...coupon, active: c.active === false } }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not change the coupon')
      notifySuccess(data.active === false ? `${data.code} switched off.` : `${data.code} switched on.`)
      await load()
    } catch (err) {
      notifyError(err)
    }
  }

  async function remove(slug: string, c: Row) {
    if (!(await confirmAction({
      title: 'Delete this coupon?',
      message: `${c.code} will stop applying to new bookings. Bookings that already used it keep their discount. To pause it instead, switch it off.`,
      confirmLabel: 'Delete coupon',
      tone: 'danger',
    }))) return
    try {
      const res = await fetch(url(slug, c.code), { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not delete the coupon')
      notifySuccess(`${c.code} deleted.`)
      if (editing && editing.slug === slug && editing.code === c.code) cancelEdit()
      await load()
    } catch (err) {
      notifyError(err)
    }
  }

  const preview = form.code.trim() && Number(form.value) > 0 ? describeCoupon(toCoupon(form)) : null
  const field = { width: '100%' }
  const label = { fontWeight: 600, display: 'block', marginBottom: '6px' } as const

  return (
    // minmax(0, 1fr): without it the one column grows to the tables' natural
    // width on a phone instead of letting .table-responsive scroll them.
    <div className="grid" style={{ padding: 'clamp(12px, 3vw, 24px) 0', gap: '24px', gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <section ref={formRef} className="admin-section-card" style={{ marginTop: 0, scrollMarginTop: '80px' }}>
        <h3 style={{ marginTop: 0 }}>{editing ? `Edit ${editing.code}` : 'New coupon'}</h3>
        <p className="text-muted" style={{ marginTop: 0, fontSize: '0.9rem' }}>
          A coupon takes off a flat amount or a percentage of the basket. Its conditions
          are <strong>alternatives</strong>: with both ticked it applies to a basket over the
          threshold <em>or</em> to one of the first N registrations. With neither ticked it
          applies to anyone who types it. Registrations are counted as bookings, not passes.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
          <div style={{ display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', alignItems: 'end' }}>
            <div>
              <label htmlFor="cp-event" style={label}>Event *</label>
              <select id="cp-event" className="form-control" style={field} value={form.eventSlug}
                onChange={(e) => set({ eventSlug: e.target.value })} disabled={Boolean(editing)} required>
                {events.map((ev) => <option key={ev.slug} value={ev.slug}>{ev.name}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="cp-code" style={label}>Code *</label>
              <input id="cp-code" className="form-control" style={field} placeholder="e.g. EARLYBIRD"
                value={form.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })}
                required minLength={2} maxLength={40} pattern="[A-Za-z0-9_\-]+"
                title="Letters, digits, - and _ only" />
            </div>

            <div>
              <label htmlFor="cp-kind" style={label}>Discount type *</label>
              <select id="cp-kind" className="form-control" style={field} value={form.kind}
                onChange={(e) => set({ kind: e.target.value as CouponKind })}>
                <option value="fixed">Flat amount (₹)</option>
                <option value="percent">Percentage of total (%)</option>
              </select>
            </div>

            <div>
              <label htmlFor="cp-value" style={label}>{form.kind === 'percent' ? 'Percent off *' : 'Rupees off *'}</label>
              <input id="cp-value" type="number" className="form-control" style={field}
                placeholder={form.kind === 'percent' ? 'e.g. 10' : 'e.g. 50'} min={1} max={form.kind === 'percent' ? 100 : undefined} step={1}
                value={form.value} onChange={(e) => set({ value: e.target.value })} required />
            </div>

            {form.kind === 'percent' && (
              <div>
                <label htmlFor="cp-cap" style={label}>Cap (₹, optional)</label>
                <input id="cp-cap" type="number" className="form-control" style={field}
                  placeholder="No cap" min={1} step={1}
                  value={form.maxDiscount} onChange={(e) => set({ maxDiscount: e.target.value })} />
              </div>
            )}
          </div>

          {/* A fieldset is min-content wide by default, which pushed the card
              past a phone's edge; minWidth 0 lets its rows wrap instead. */}
          <fieldset style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', margin: 0, display: 'grid', gap: '12px', minWidth: 0 }}>
            <legend style={{ fontWeight: 600, padding: '0 6px' }}>Applies when</legend>

            <label style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={form.useThreshold} onChange={(e) => set({ useThreshold: e.target.checked })} />
              the total before discount is more than ₹
              <input type="number" className="form-control" style={{ width: '120px' }} min={0} step={1}
                aria-label="Basket threshold in rupees"
                value={form.minSubtotal} disabled={!form.useThreshold}
                onChange={(e) => set({ minSubtotal: e.target.value })} required={form.useThreshold} />
            </label>

            <label style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" checked={form.useFirstN} onChange={(e) => set({ useFirstN: e.target.checked })} />
              the booking is among the first
              <input type="number" className="form-control" style={{ width: '100px' }} min={1} step={1}
                aria-label="Number of first registrations"
                value={form.firstN} disabled={!form.useFirstN}
                onChange={(e) => set({ firstN: e.target.value })} required={form.useFirstN} />
              registrations for the event
            </label>

            {form.useThreshold && form.useFirstN && (
              <p className="text-muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                Either condition is enough.
              </p>
            )}
          </fieldset>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} />
            Active — visitors can apply it now
          </label>

          {/* Says back what is about to be saved, in the words the admin list
              uses, so a wrong box is obvious before it goes live. */}
          <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            {preview ? <>Will read: <strong>{form.code.trim().toUpperCase()}</strong> — {preview}</> : 'Fill in a code and an amount to see how it will read.'}
          </p>

          {formError && <div className="form-status form-status--error" style={{ display: 'block' }}>{formError}</div>}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" type="submit" disabled={saving || events.length === 0}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add coupon'}
            </button>
            {editing && (
              <button className="btn btn-secondary" type="button" onClick={cancelEdit} disabled={saving}>Cancel</button>
            )}
          </div>
        </form>
      </section>

      {loading && <section className="admin-section-card" style={{ marginTop: 0 }}><p className="text-muted" style={{ margin: 0 }}>Loading…</p></section>}
      {loadError && <div className="form-status form-status--error" style={{ display: 'block' }}>{loadError}</div>}

      {!loading && events.map((ev) => (
        <section key={ev.slug} id={ev.slug} className="admin-section-card" style={{ marginTop: 0, scrollMarginTop: '80px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>
              {ev.name}{' '}
              {ev.status && <span className={`badge badge--${ev.status.toLowerCase()}`} style={{ marginLeft: '6px', verticalAlign: 'middle' }}>{ev.status}</span>}
            </h3>
            <span className="text-muted" style={{ fontSize: '0.85rem' }}>
              {ev.registrations === null ? 'Registrations: unavailable' : `${ev.registrations} registration${ev.registrations === 1 ? '' : 's'} so far`}
              {' · '}
              <Link href={`/admin/events/${ev.slug}/edit`}>Event settings</Link>
            </span>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr><th>Code</th><th>Discount &amp; conditions</th><th>Used by</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {ev.coupons.length === 0 && (
                  <tr><td colSpan={5} className="text-muted">No coupons for this event.</td></tr>
                )}
                {ev.coupons.map((c) => {
                  const on = c.active !== false
                  const early = earlyStanding(c, ev.registrations)
                  return (
                    <tr key={c.code}>
                      <td><code>{c.code}</code></td>
                      <td>
                        {describeCoupon(c)}
                        {early && <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>{early}</div>}
                      </td>
                      <td>{c.uses === null ? '—' : `${c.uses} booking${c.uses === 1 ? '' : 's'}`}</td>
                      <td><span className={`badge ${on ? 'badge--open' : 'badge--closed'}`}>{on ? 'Active' : 'Off'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button type="button" className="btn btn-sm btn-secondary" onClick={() => startEdit(ev.slug, c)}>Edit</button>
                          <button type="button" className="btn btn-sm btn-secondary" onClick={() => toggle(ev.slug, c)}>{on ? 'Switch off' : 'Switch on'}</button>
                          <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(ev.slug, c)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
