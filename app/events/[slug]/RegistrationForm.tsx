'use client'

import { useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

type RegistrationFormProps = {
  event: any
}

const UPI_ID = 'utsav.iiit@okhdfcbank'

function formatCurrency(n: number) {
  return n === 0 ? 'Free' : `₹${n.toLocaleString('en-IN')}`
}

export default function RegistrationForm({ event }: RegistrationFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isIiit, setIsIiit] = useState<'yes' | 'no'>('yes')
  const [numPasses, setNumPasses] = useState(1)
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null)
  const [couponMessage, setCouponMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirmation, setConfirmation] = useState<any>(null)

  const isFree = event.price === 0
  const passPrice = isFree ? 0 : isIiit === 'yes' ? 250 : 350
  const subtotal = numPasses * passPrice
  const discount = appliedCoupon ? appliedCoupon.discount : 0
  const total = Math.max(0, subtotal - discount)

  const upiUri = useMemo(() => {
    const note = `${event.name} Pass (${numPasses} attendee${numPasses > 1 ? 's' : ''}${appliedCoupon ? ' - ' + appliedCoupon.code : ''})`
    return `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=BANGIYA.SAMITI&am=${total}&cu=INR&tn=${encodeURIComponent(note)}`
  }, [event.name, numPasses, appliedCoupon, total])

  function validate(formData: FormData): { ok: boolean; error?: string } {
    const fullName = String(isIiit === 'yes' ? formData.get('full_name') : formData.get('outside_full_name') || '').trim()
    const email = String(isIiit === 'yes' ? formData.get('email') : formData.get('outside_email') || '').trim()
    const phone = String(isIiit === 'yes' ? formData.get('phone') : formData.get('outside_phone') || '').trim()
    const collegeId = String(isIiit === 'yes' ? formData.get('college_id') : formData.get('organization') || '').trim()
    const city = String(formData.get('city') || '').trim()
    const utr = String(formData.get('utr') || '').trim()

    if (!fullName) return { ok: false, error: 'Please enter your full name.' }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Please provide a valid email address.' }
    if (phone.replace(/\D/g, '').length < 10) return { ok: false, error: 'Please enter a valid 10-digit phone number.' }
    if (isIiit === 'yes' && !collegeId) return { ok: false, error: 'Please enter your IIIT Hyderabad Roll Number or ID.' }
    if (isIiit === 'no' && !collegeId) return { ok: false, error: 'Please enter your College or Organization name.' }
    if (isIiit === 'no' && !city) return { ok: false, error: 'Please enter your City.' }
    if (!isFree && utr.length < 6) return { ok: false, error: 'Please complete payment and enter your 12-digit UPI UTR / Transaction reference number.' }
    return { ok: true }
  }

  function applyCoupon() {
    const code = couponInput.trim().toLowerCase()
    if (!code) {
      setCouponMessage({ type: 'error', text: 'Please enter a coupon code.' })
      setAppliedCoupon(null)
      return
    }
    if (['mahalaya26', 'saraswati27', 'saraswati26'].includes(code)) {
      setAppliedCoupon({ code: code === 'saraswati26' ? 'saraswati27' : code, discount: 50 })
      setCouponMessage({ type: 'success', text: '✓ Coupon applied · ₹50 saved' })
    } else {
      setAppliedCoupon(null)
      setCouponMessage({ type: 'error', text: 'Invalid coupon code.' })
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    const validation = validate(formData)
    if (!validation.ok) {
      setError(validation.error || 'Validation failed')
      return
    }

    const participantName = String(isIiit === 'yes' ? formData.get('full_name') : formData.get('outside_full_name'))
    const email = String(isIiit === 'yes' ? formData.get('email') : formData.get('outside_email'))
    const phone = String(isIiit === 'yes' ? formData.get('phone') : formData.get('outside_phone'))
    const collegeId = String(isIiit === 'yes' ? formData.get('college_id') : formData.get('organization'))
    const city = isIiit === 'no' ? String(formData.get('city') || '') : ''
    const utr = String(formData.get('utr') || (isFree ? 'FREE-PASS' : ''))

    setLoading(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventSlug: event.slug,
          participantName,
          collegeId: collegeId + (city ? ` (${city})` : ''),
          phone,
          email,
          utr,
          numPasses,
          foodPref: String(formData.get('food_pref') || ''),
          isIiit: isIiit === 'yes',
          couponCode: appliedCoupon?.code || '',
          discountAmount: discount,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')
      setConfirmation({ ...data, amount: total })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (confirmation) {
    return (
      <div className="mahalaya-confirmation">
        <div className="mahalaya-confirmation__badge">✓ REGISTRATION SUBMITTED</div>
        <h3 className="mahalaya-confirmation__title">{event.name} Pass Request Recorded</h3>
        <p className="mahalaya-confirmation__attendee">Attendee: <strong>{confirmation.participant_name}</strong> (<span>{confirmation.college_id}</span>)</p>

        <div className="mahalaya-confirmation__tokenBox">
          <span>RESERVATION TOKEN</span>
          <strong>{confirmation.token}</strong>
        </div>

        <div className="mahalaya-confirmation__details">
          <p>🎟️ <strong>Passes:</strong> {numPasses} Pass{numPasses > 1 ? 'es' : ''} ({formatCurrency(confirmation.amount)})</p>
          <p>💳 <strong>Payment Status:</strong> {confirmation.payment_status === 'APPROVED' ? 'Verified' : 'Pending Verification'} (UTR: <code>{confirmation.utr}</code>)</p>
        </div>

        <div className="mahalaya-confirmation__emailNotice">
          <p>✉️ <strong>Digital QR Pass Delivery Notice:</strong></p>
          <p>Your verified digital QR pass and entry confirmation will be dispatched directly to your registered email (<strong>{confirmation.email}</strong>) upon transaction verification. Please present the QR code received in your inbox at the gate.</p>
        </div>

        <div className="mahalaya-confirmation__actions">
          <button type="button" className="mahalaya-card__altBtn" onClick={() => setConfirmation(null)}>Register Another Attendee</button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mahalaya-form-section">
        <h3 className="mahalaya-form-section__heading">YOUR DETAILS</h3>

        <div className="mahalaya-affiliation-row">
          <span className="mahalaya-affiliation-title">Are you associated with IIIT Hyderabad? *</span>
          <div className="mahalaya-affiliation-group">
            <label className="mahalaya-radio-label">
              <input type="radio" name="is_iiit" value="yes" checked={isIiit === 'yes'} onChange={() => setIsIiit('yes')} />
              <span>Yes (IIITH Member)</span>
            </label>
            <label className="mahalaya-radio-label">
              <input type="radio" name="is_iiit" value="no" checked={isIiit === 'no'} onChange={() => setIsIiit('no')} />
              <span>No (Outside Guest)</span>
            </label>
          </div>
        </div>

        {isIiit === 'yes' ? (
          <div className="mahalaya-form-grid">
            <div className="field"><label htmlFor="full_name">Full Name *</label><input id="full_name" name="full_name" type="text" placeholder="e.g. Arka Mukhopadhyay" required autoComplete="name" /></div>
            <div className="field"><label htmlFor="email">Email Address *</label><input id="email" name="email" type="email" placeholder="name@students.iiit.ac.in" required autoComplete="email" /></div>
            <div className="field"><label htmlFor="phone">Phone Number *</label><input id="phone" name="phone" type="tel" placeholder="+91 98765 43210" required autoComplete="tel" /></div>
            <div className="field"><label htmlFor="college_id">IIIT Roll No / ID *</label><input id="college_id" name="college_id" type="text" placeholder="e.g. 202401042 / Staff ID" required /></div>
          </div>
        ) : (
          <div className="mahalaya-form-grid">
            <div className="field"><label htmlFor="outside_full_name">Full Name *</label><input id="outside_full_name" name="outside_full_name" type="text" placeholder="e.g. Priyobroto Sen" required autoComplete="name" /></div>
            <div className="field"><label htmlFor="outside_email">Email Address *</label><input id="outside_email" name="outside_email" type="email" placeholder="name@domain.com" required autoComplete="email" /></div>
            <div className="field"><label htmlFor="outside_phone">Phone Number *</label><input id="outside_phone" name="outside_phone" type="tel" placeholder="+91 98765 43210" required autoComplete="tel" /></div>
            <div className="field"><label htmlFor="organization">College / Organization *</label><input id="organization" name="organization" type="text" placeholder="e.g. University / Company" required /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label htmlFor="city">City *</label><input id="city" name="city" type="text" placeholder="e.g. Hyderabad / Kolkata" required /></div>
          </div>
        )}

        <div className="mahalaya-form-grid" style={{ marginTop: '6px' }}>
          <div className="field">
            <label htmlFor="num_passes">Number of Passes</label>
            <select id="num_passes" name="num_passes" value={numPasses} onChange={(e) => setNumPasses(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} Pass{n > 1 ? 'es' : ''}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="food_pref">{isMahalaya(event.slug) ? 'Food Preference' : 'Lunch & Prasad Option'}</label>
            <select id="food_pref" name="food_pref">
              {isMahalaya(event.slug) ? (
                <>
                  <option value="Non-Veg (Authentic Bhoj)">Non-Veg (Fish &amp; Chicken Feast)</option>
                  <option value="Veg (Special Veg Thali)">Veg (Traditional Niramish Thali)</option>
                </>
              ) : (
                <>
                  <option value="Khichuri Prosad Feast (Sit-down Lunch)">Khichuri Prosad Feast (Sit-down Lunch)</option>
                  <option value="Pushpanjali & Sweet Prasad Only">Pushpanjali &amp; Sweet Prasad Only</option>
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      {!isFree && (
        <div className="mahalaya-form-section mahalaya-form-section--payment">
          <h3 className="mahalaya-form-section__heading">PAYMENT</h3>

          <div className="mahalaya-checkout-box">
            <div className="mahalaya-checkout-box__header">
              <div>
                <span className="mahalaya-checkout-box__label">TOTAL AMOUNT DUE</span>
                <strong className="mahalaya-checkout-box__price">{formatCurrency(total)}</strong>
                {appliedCoupon && <span className="mahalaya-coupon-badge">✓ Coupon Applied (−₹{appliedCoupon.discount})</span>}
              </div>
              <div className="mahalaya-checkout-box__rate">{formatCurrency(passPrice)} / pass</div>
            </div>

            <div className="mahalaya-coupon-row">
              <div className="mahalaya-coupon-input-group">
                <input type="text" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder="Coupon code (e.g. mahalaya26)" autoComplete="off" />
                <button type="button" className="mahalaya-coupon-btn" onClick={applyCoupon}>APPLY</button>
              </div>
              {couponMessage && (
                <div className={`mahalaya-coupon-msg ${couponMessage.type === 'success' ? 'mahalaya-coupon-msg--success' : 'mahalaya-coupon-msg--error'}`}>
                  {couponMessage.text}
                </div>
              )}
            </div>

            <div className="mahalaya-price-receipt">
              <div className="mahalaya-price-receipt__row"><span className="mahalaya-price-receipt__label">Subtotal</span><span className="mahalaya-price-receipt__val">{formatCurrency(subtotal)}</span></div>
              <div className="mahalaya-price-receipt__row mahalaya-price-receipt__row--discount"><span className="mahalaya-price-receipt__label">Discount</span><span className="mahalaya-price-receipt__val">−{formatCurrency(discount)}</span></div>
              <div className="mahalaya-price-receipt__divider"></div>
              <div className="mahalaya-price-receipt__row mahalaya-price-receipt__row--total"><span className="mahalaya-price-receipt__label">TOTAL</span><span className="mahalaya-price-receipt__val">{formatCurrency(total)}</span></div>
            </div>

            <div className="mahalaya-upi-grid">
              <div className="mahalaya-upi-qr">
                <div className="mahalaya-upi-qr__frame">
                  <QRCodeSVG value={upiUri} size={92} level="M" bgColor="#ffffff" fgColor="#281208" />
                </div>
                <span className="mahalaya-upi-qr__hint">Scan with GPay / PhonePe / Paytm</span>
              </div>

              <div className="mahalaya-upi-info">
                <div className="mahalaya-upi-id-row">
                  <span>UPI:</span>
                  <code>{UPI_ID}</code>
                  <button type="button" className="mahalaya-copy-btn" onClick={() => navigator.clipboard?.writeText(UPI_ID)}>Copy</button>
                </div>
                <a href={upiUri} className="mahalaya-pay-now-btn"><span>⚡ PAY NOW VIA UPI APP</span></a>
              </div>
            </div>

            <div className="field mahalaya-utr-field">
              <label htmlFor="utr">12-Digit UPI Transaction UTR / Ref Number *</label>
              <input id="utr" name="utr" type="text" placeholder="e.g. 429810294812" required pattern="[0-9A-Za-z_-]{6,24}" autoComplete="off" />
              <small className="field-hint">Enter 12-digit UTR from your UPI payment receipt</small>
            </div>
          </div>
        </div>
      )}

      <div className="mahalaya-confirm-box">
        <label className="mahalaya-checkbox-label">
          <input type="checkbox" name="confirm_details" required />
          <span>I confirm that the details provided are accurate and the UPI payment is completed / initiated.</span>
        </label>
      </div>

      <button className="mahalaya-card__submitBtn" type="submit" disabled={loading}>
        <span>{loading ? 'PROCESSING...' : 'REGISTER & GET MY PASS →'}</span>
      </button>

      {error && (
        <div className="form-status form-status--error" aria-live="polite" style={{ marginTop: '1rem', display: 'block' }}>
          <span className="utsav-toast__icon">✕</span>
          <span>{error}</span>
        </div>
      )}
    </form>
  )
}

function isMahalaya(slug: string) {
  return slug === 'mahalaya'
}
