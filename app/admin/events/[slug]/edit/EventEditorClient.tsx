'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function EventEditorClient({ event }: { event: any }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [capacity, setCapacity] = useState(event.capacity || 0)
  const [upiIds, setUpiIds] = useState<string[]>(
    event.config?.upi_ids || (event.config?.upi_id ? [event.config.upi_id] : [''])
  )
  const [upiQrUrl, setUpiQrUrl] = useState(event.config?.upi_qr_url || '')
  
  const [passTypes, setPassTypes] = useState<{name: string, price: number}[]>(
    event.config?.pass_types || [{ name: 'Standard Pass', price: event.price || 0 }]
  )
  const [coupons, setCoupons] = useState<{code: string, discount: number}[]>(
    event.config?.coupons || []
  )

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
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const updates = {
        capacity: Number(capacity),
        // price is legacy, keep it synced to the first pass type for backwards compatibility
        price: passTypes.length > 0 ? passTypes[0].price : 0,
        config: {
          ...event.config,
          pass_types: passTypes,
          upi_ids: upiIds.filter(id => id.trim() !== ''),
          upi_qr_url: upiQrUrl,
          coupons: coupons
        }
      }

      const res = await fetch(`/api/admin/events/${event.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (!res.ok) throw new Error('Failed to save')
      alert('Event settings updated successfully!')
      router.refresh()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="admin-section-card" style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* Basics */}
      <div>
        <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>General Settings</h3>
        <div className="form-group">
          <label>Total Registration Capacity (Max Seats)</label>
          <input 
            type="number" 
            className="form-control" 
            value={capacity} 
            onChange={e => setCapacity(e.target.value as any)} 
            min="0"
          />
        </div>
      </div>

      {/* Pass Types */}
      <div>
        <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>Pass Types & Pricing</h3>
        <p className="text-muted" style={{ marginBottom: '12px' }}>Define the different pass variants available (e.g., Veg and Non-Veg).</p>
        
        {passTypes.map((pt, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <input type="text" className="form-control" placeholder="Pass Name (e.g. Veg Thali)" value={pt.name} onChange={e => {
              const newPts = [...passTypes]; newPts[i].name = e.target.value; setPassTypes(newPts)
            }} required />
            <input type="number" className="form-control" style={{ width: '150px' }} placeholder="Price (₹)" value={pt.price} onChange={e => {
              const newPts = [...passTypes]; newPts[i].price = Number(e.target.value); setPassTypes(newPts)
            }} required min="0" />
            <button type="button" className="btn btn-sm btn-danger" onClick={() => setPassTypes(passTypes.filter((_, idx) => idx !== i))}>&times;</button>
          </div>
        ))}
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => setPassTypes([...passTypes, { name: '', price: 0 }])}>+ Add Pass Type</button>
      </div>

      {/* Payment Configuration */}
      <div>
        <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>Payment Settings</h3>
        <div className="form-group">
          <label>UPI IDs (for payments)</label>
          <p className="text-muted" style={{ marginBottom: '8px', fontSize: '0.85rem' }}>Add one or more UPI IDs. Users can select which one to pay to.</p>
          {upiIds.map((id, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input type="text" className="form-control" placeholder="yourname@bank" value={id} onChange={e => {
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

      {/* Coupons */}
      <div>
        <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>Coupons</h3>
        {coupons.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <input type="text" className="form-control" placeholder="Code (e.g. EARLY10)" value={c.code} onChange={e => {
              const newC = [...coupons]; newC[i].code = e.target.value.toUpperCase(); setCoupons(newC)
            }} required />
            <input type="number" className="form-control" style={{ width: '150px' }} placeholder="Discount (₹)" value={c.discount} onChange={e => {
              const newC = [...coupons]; newC[i].discount = Number(e.target.value); setCoupons(newC)
            }} required min="0" />
            <button type="button" className="btn btn-sm btn-danger" onClick={() => setCoupons(coupons.filter((_, idx) => idx !== i))}>&times;</button>
          </div>
        ))}
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => setCoupons([...coupons, { code: '', discount: 0 }])}>+ Add Coupon</button>
      </div>

      <div style={{ marginTop: '10px' }}>
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Saving...' : 'Save All Changes'}
        </button>
      </div>
    </form>
  )
}
