'use client'

import { useState } from 'react'
// The same shape the registration form prices from, so the editor cannot save
// a pass type the form does not understand.
import type { PassType } from '@/utils/pricing'
// The same shape and the same wording the registration form resolves against.
import { describeCoupon, type Coupon } from '@/utils/coupons'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { notifyError, notifySuccess } from '@/components/site-notifications'

export default function EventEditorClient({ event }: { event: any }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  const [name, setName] = useState(event.name || '')
  const [category, setCategory] = useState(event.category || '')
  const [eventDate, setEventDate] = useState(event.event_date || '')
  const [venue, setVenue] = useState(event.venue || '')
  const [description, setDescription] = useState(event.description || '')
  
  const [capacity, setCapacity] = useState(event.capacity || 0)
  const [upiIds, setUpiIds] = useState<string[]>(
    event.config?.upi_ids || (event.config?.upi_id ? [event.config.upi_id] : [''])
  )
  const [upiQrUrl, setUpiQrUrl] = useState(event.config?.upi_qr_url || '')
  
  const [passTypes, setPassTypes] = useState<PassType[]>(
    event.config?.pass_types || [{ name: 'Standard Pass', price: event.price || 0 }]
  )
  // Read-only here: /admin/coupons owns the list.
  const coupons: Coupon[] = Array.isArray(event.config?.coupons) ? event.config.coupons : []

  const handleUploadQr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const formData = new FormData()
    formData.append('file', file)
    
    setLoading(true)
    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUpiQrUrl(data.url)
    } catch (err: any) {
      notifyError(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const updates = {
        name,
        category,
        event_date: eventDate,
        venue,
        description,
        capacity: Number(capacity),
        // price is legacy, keep it synced to the first pass type for backwards compatibility
        price: passTypes.length > 0 ? passTypes[0].price : 0,
        config: {
          ...event.config,
          pass_types: passTypes,
          upi_ids: upiIds.filter(id => id.trim() !== ''),
          upi_qr_url: upiQrUrl,
          // The coupons carried in by ...event.config are ignored: the events
          // route keeps the list on file, which /admin/coupons writes.
        }
      }

      const res = await fetch(`/api/admin/events/${event.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (!res.ok) throw new Error('Failed to save')
      notifySuccess('Event settings updated.')
      router.refresh()
    } catch (err: any) {
      notifyError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="admin-section-card" style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Basics */}
      <div>
        <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>General Settings</h3>
        <div className="form-group admin-field-pair">
          <div>
            <label>Event Name</label>
            <input type="text" className="form-control" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label>Category (e.g. Neighbourhood bhoj)</label>
            <input type="text" className="form-control" value={category} onChange={e => setCategory(e.target.value)} required />
          </div>
          <div>
            <label>Scheduled Date (YYYY-MM-DD)</label>
            <input type="date" className="form-control" value={eventDate} onChange={e => setEventDate(e.target.value)} required />
          </div>
          <div>
            <label>Venue</label>
            <input type="text" className="form-control" value={venue} onChange={e => setVenue(e.target.value)} required />
          </div>
        </div>
        
        <div className="form-group" style={{ marginTop: '20px' }}>
          <label>Event Description</label>
          <textarea className="form-control" rows={3} value={description} onChange={e => setDescription(e.target.value)} required />
        </div>

        <div className="form-group" style={{ marginTop: '20px' }}>
          <label>Total Registration Capacity (Max Seats)</label>
          <input 
            type="number" 
            className="form-control" 
            style={{ width: '200px' }}
            value={capacity} 
            onChange={e => setCapacity(e.target.value as any)} 
            min="0"
          />
        </div>
      </div>

      {/* Pass Types */}
      <div>
        <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>Pass Types &amp; Pricing</h3>
        <p className="text-muted" style={{ marginBottom: '4px' }}>
          Define the pass variants available (e.g. Veg and Non-Veg). Give two passes
          the same <strong>Meal</strong> and they are shown together as one section on
          the registration form &mdash; Breakfast beside Lunch. Leave Meal blank for a
          single ungrouped list.
        </p>
        <p className="text-muted" style={{ marginBottom: '12px', fontSize: '0.85rem' }}>
          Each pass has three prices. A visitor is only ever shown the one that applies
          to them; the registration form never reveals that the others exist. Students
          and research staff are recognised by their <code>@students</code> or{' '}
          <code>@research</code> address, anyone else at <code>iiit.ac.in</code> pays
          the staff price, and everybody else pays guest.
        </p>

        <div className="admin-pass-grid admin-pass-grid--head" style={{ alignItems: 'end', marginBottom: '6px' }}>
          <label className="text-muted" style={{ fontSize: '0.78rem' }}>Pass name</label>
          <label className="text-muted" style={{ fontSize: '0.78rem' }}>Meal (optional)</label>
          <label className="text-muted" style={{ fontSize: '0.78rem' }}>Student ₹</label>
          <label className="text-muted" style={{ fontSize: '0.78rem' }}>Staff ₹</label>
          <label className="text-muted" style={{ fontSize: '0.78rem' }}>Guest ₹</label>
          <span />
        </div>

        {passTypes.map((pt, i) => {
          // Older events carry one `price` and no per-audience table. Showing
          // that value in all three boxes keeps the price they already charge
          // until somebody deliberately changes one of them.
          const priceFor = (key: 'student' | 'staff' | 'guest') =>
            pt.prices && pt.prices[key] !== undefined && pt.prices[key] !== null
              ? pt.prices[key]
              : (pt.price ?? 0)

          const setPrice = (key: 'student' | 'staff' | 'guest', value: string) => {
            const next = [...passTypes]
            const prices = { student: priceFor('student'), staff: priceFor('staff'), guest: priceFor('guest') }
            prices[key] = Number(value)
            next[i] = { ...next[i], prices }
            setPassTypes(next)
          }

          return (
            <div key={i} className="admin-pass-grid" style={{ marginBottom: '10px' }}>
              <input type="text" className="form-control" placeholder="Enter Pass Name" value={pt.name} onChange={e => {
                const next = [...passTypes]; next[i] = { ...next[i], name: e.target.value }; setPassTypes(next)
              }} required />
              <input type="text" className="form-control" placeholder="Enter Meal" value={pt.meal || ''} onChange={e => {
                const next = [...passTypes]; next[i] = { ...next[i], meal: e.target.value }; setPassTypes(next)
              }} />
              <input type="number" className="form-control" placeholder="Enter Student Price" min="0"
                value={priceFor('student')} onChange={e => setPrice('student', e.target.value)} required />
              <input type="number" className="form-control" placeholder="Enter Staff Price" min="0"
                value={priceFor('staff')} onChange={e => setPrice('staff', e.target.value)} required />
              <input type="number" className="form-control" placeholder="Enter Guest Price" min="0"
                value={priceFor('guest')} onChange={e => setPrice('guest', e.target.value)} required />
              <button type="button" className="btn btn-sm btn-danger" onClick={() => setPassTypes(passTypes.filter((_, idx) => idx !== i))}>&times;</button>
            </div>
          )
        })}
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => setPassTypes([...passTypes, { name: '', meal: '', prices: { student: 0, staff: 0, guest: 0 } }])}>+ Add Pass Type</button>
      </div>

      {/* Payment Configuration */}
      <div>
        <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>Payment Settings</h3>
        <div className="form-group">
          <label>UPI IDs (for payments)</label>
          <p className="text-muted" style={{ marginBottom: '8px', fontSize: '0.85rem' }}>Add one or more UPI IDs. Users can select which one to pay to.</p>
          {upiIds.map((id, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input type="text" className="form-control" placeholder="Enter UPI ID" value={id} onChange={e => {
                const newIds = [...upiIds]; newIds[i] = e.target.value; setUpiIds(newIds)
              }} required />
              {upiIds.length > 1 && (
                <button type="button" className="btn btn-sm btn-danger" onClick={() => setUpiIds(upiIds.filter((_, idx) => idx !== i))}>&times;</button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setUpiIds([...upiIds, ''])}>+ Add UPI ID</button>
        </div>

        <div className="form-group" style={{ marginTop: '20px' }}>
          <label>Custom UPI QR Code Image (Optional)</label>
          {upiQrUrl && <img src={upiQrUrl} alt="QR" style={{ height: '120px', display: 'block', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '8px' }} />}
          <input type="file" accept="image/*" className="form-control" onChange={handleUploadQr} disabled={loading} />
          <small className="text-muted">If uploaded, this custom image will be displayed instead of an auto-generated QR code.</small>
        </div>
      </div>

      {/* Coupons - managed on their own page; shown here so the event's
          settings still say what discounts it carries. */}
      <div>
        <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>Coupons</h3>
        <p className="text-muted" style={{ marginBottom: '12px' }}>
          Coupon codes are added, changed, switched off and deleted under{' '}
          <strong>Coupon Codes</strong>. Saving this form leaves them as they are.
        </p>
        {coupons.length === 0 ? (
          <p className="text-muted" style={{ marginBottom: '12px', fontSize: '0.9rem' }}>This event has no coupons.</p>
        ) : (
          <ul style={{ margin: '0 0 12px', paddingLeft: '18px', fontSize: '0.9rem' }}>
            {coupons.map((c) => (
              <li key={c.code}>
                <code>{c.code}</code> &mdash; {describeCoupon(c)}{c.active === false ? ' (off)' : ''}
              </li>
            ))}
          </ul>
        )}
        <Link className="btn btn-sm btn-secondary" href={`/admin/coupons#${event.slug}`}>Manage coupons &rarr;</Link>
      </div>

      <div style={{ marginTop: '10px' }}>
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Saving...' : 'Save All Changes'}
        </button>
      </div>
    </form>
  )
}
