'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'

type RegistrationFormProps = { event: any }

const UPI_ID = 'utsav.iiit@okhdfcbank'
const DRAFT_KEY = 'utsavpass_registration_draft_v3'

function formatCurrency(n: number) { return n === 0 ? 'Free' : `₹${n.toLocaleString('en-IN')}` }
function isMahalaya(slug: string) { return slug === 'mahalaya' }

type DraftState = {
  isIiit: 'yes' | 'no' | null
  fullName: string
  email: string
  phone: string
  collegeId: string
  city: string
  numPasses: number
  foodPref: string
  couponInput: string
  appliedCoupon: { code: string; discount: number } | null
  utr: string
  screenshot: string | null
  stage: number
  paymentState: 'READY' | 'COMPLETED'
}

const DEFAULT_DRAFT: DraftState = {
  isIiit: null, fullName: '', email: '', phone: '', collegeId: '', city: '',
  numPasses: 1, foodPref: '', couponInput: '', appliedCoupon: null,
  utr: '', screenshot: null, stage: 1, paymentState: 'READY'
}

export default function RegistrationForm({ event }: RegistrationFormProps) {
  const [draft, setDraft] = useState<DraftState>(DEFAULT_DRAFT)
  const [isLoaded, setIsLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [couponMsg, setCouponMsg] = useState<{type: 'success'|'error', text: string} | null>(null)
  const [confirmation, setConfirmation] = useState<any>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY + '_' + event.slug)
      if (saved) setDraft({ ...DEFAULT_DRAFT, ...JSON.parse(saved) })
    } catch(e) {}
    setIsLoaded(true)
  }, [event.slug])

  useEffect(() => {
    if (isLoaded && !confirmation) localStorage.setItem(DRAFT_KEY + '_' + event.slug, JSON.stringify(draft))
  }, [draft, isLoaded, confirmation, event.slug])

  const updateDraft = (u: Partial<DraftState>) => setDraft(p => ({ ...p, ...u }))

  const nextStage = () => {
    setError(null)
    if (draft.stage === 1 && !draft.isIiit) return setError('Select an association.')
    if (draft.stage === 2) {
      if (!draft.fullName.trim()) return setError('Enter full name.')
      if (!draft.email.includes('@')) return setError('Invalid email.')
      if (draft.phone.length < 10) return setError('Invalid phone.')
      if (draft.isIiit === 'yes' && !draft.collegeId.trim()) return setError('Enter IIIT Roll No.')
      if (draft.isIiit === 'no' && !draft.collegeId.trim()) return setError('Enter Organization.')
      if (draft.isIiit === 'no' && !draft.city.trim()) return setError('Enter City.')
    }
    if (draft.stage === 3 && !draft.foodPref) return setError('Select food preference.')
    if (draft.stage === 4 && draft.paymentState === 'COMPLETED') {
      if (passPrice > 0 && draft.utr.length < 6) return setError('Enter valid UTR.')
      if (passPrice > 0 && !draft.screenshot) return setError('Upload receipt.')
    }
    updateDraft({ stage: draft.stage + 1 })
  }
  const prevStage = () => { setError(null); updateDraft({ stage: draft.stage - 1 }) }

  const isFree = event.price === 0
  const passPrice = isFree ? 0 : draft.isIiit === 'yes' ? 250 : 350
  const subtotal = draft.numPasses * passPrice
  const discount = draft.appliedCoupon ? draft.appliedCoupon.discount : 0
  const total = Math.max(0, subtotal - discount)

  const applyCoupon = () => {
    const code = draft.couponInput.trim().toLowerCase()
    if (['mahalaya26'].includes(code)) {
      updateDraft({ appliedCoupon: { code, discount: 50 } })
      setCouponMsg({ type: 'success', text: '✓ Coupon applied' })
    } else {
      updateDraft({ appliedCoupon: null })
      setCouponMsg({ type: 'error', text: 'Invalid coupon' })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventSlug: event.slug,
          participantName: draft.fullName,
          collegeId: draft.collegeId,
          phone: draft.phone,
          email: draft.email,
          utr: draft.utr || 'FREE',
          numPasses: draft.numPasses,
          foodPref: draft.foodPref,
          isIiit: draft.isIiit === 'yes',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setConfirmation({ ...data, amount: total })
      updateDraft({ stage: 6 })
      localStorage.removeItem(DRAFT_KEY + '_' + event.slug)
    } catch (err: any) { setError(err.message) } finally { setLoading(false) }
  }

  if (!isLoaded) return <div>Loading...</div>

  const stepProps = { draft, updateDraft, nextStage, prevStage, error, setError, total, subtotal, discount, applyCoupon, couponMsg, handleSubmit, loading, confirmation, setScreenshotPreview, screenshotPreview }

  return (
    <div className="reg-shell">
      {/* Decorative Assets */}
      <img src="/mahalaya_registration_assets/03_corner_top_left.png" className="reg-corner-tl" alt="" />
      <img src="/mahalaya_registration_assets/04_corner_top_right.png" className="reg-corner-tr" alt="" />
      
      {/* Bottom Landscape (spans full bottom width) */}
      <div className="reg-bottom-decor">
        <img src="/mahalaya_registration_assets/35_decor_bottom_landscape.png" className="reg-landscape-img" alt="" />
        <img src="/mahalaya_registration_assets/36_bottom_bengali_text.png" className="reg-bengali-footer" alt="" />
      </div>

      <div className="reg-content-wrapper">
        {draft.stage < 6 && <RegistrationHeader />}
        {draft.stage < 6 && <ProgressStepper currentStage={draft.stage} />}
        {draft.stage < 6 && <img src="/mahalaya_registration_assets/06_divider_floral.png" className="reg-floral-divider" alt="" />}

        <div className="reg-step-container">
          {draft.stage === 1 && <AssociationStep {...stepProps} />}
          {draft.stage === 2 && <DetailsStep {...stepProps} />}
          {draft.stage === 3 && <PassDetailsStep {...stepProps} />}
          {draft.stage === 4 && draft.paymentState === 'READY' && <PaymentStep {...stepProps} />}
          {draft.stage === 4 && draft.paymentState === 'COMPLETED' && <PaymentCompletedStep {...stepProps} />}
          {draft.stage === 6 && <ConfirmationStep {...stepProps} />}
        </div>
      </div>
    </div>
  )
}

function RegistrationHeader() {
  return (
    <div className="reg-header">
      <div className="reg-header-titles">
        <img src="/mahalaya_registration_assets/01_title_main.png" className="reg-title-main" alt="Register for Mahalaya Bhoj" />
        {/* Do not render HTML duplicate of "Register for Mahalaya Bhoj". Just the subtitle below it */}
        <p className="reg-subtitle">Quick 1-Minute Registration &bull; Instant QR Pass Dispatched</p>
      </div>
      <img src="/mahalaya_registration_assets/02_bengali_header.png" className="reg-title-bengali" alt="Bengali script" />
    </div>
  )
}

function ProgressStepper({ currentStage }: { currentStage: number }) {
  const steps = ['ASSOCIATION', 'DETAILS', 'PASS', 'PAYMENT', 'CONFIRMATION']
  return (
    <div className="reg-stepper">
      <div className="reg-stepper-line"></div>
      {steps.map((label, idx) => {
        const stepNum = idx + 1
        const isActive = currentStage === stepNum
        const isPast = currentStage > stepNum
        return (
          <div key={label} className={`reg-step ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}>
            <div className="reg-step-circle">{isPast ? '✓' : `0${stepNum}`}</div>
            <span className="reg-step-label">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

function AssociationStep({ draft, updateDraft, nextStage, error }: any) {
  return (
    <div className="reg-association">
      <h3 className="reg-h3">ARE YOU ASSOCIATED WITH<br/>IIIT HYDERABAD?</h3>
      <p className="reg-p">Students &bull; Faculty &bull; Staff &bull; Alumni</p>
      
      <div className="reg-radio-cards">
        <label className={`reg-radio-card reg-radio-community ${draft.isIiit === 'yes' ? 'selected' : ''}`}>
          <input type="radio" checked={draft.isIiit === 'yes'} onChange={() => updateDraft({ isIiit: 'yes' })} />
          <div className="reg-radio-content">
            <span className="reg-radio-dot"></span>
            Yes, IIIT Hyderabad Community
          </div>
          <div className="reg-radio-illustration building-illus"></div>
        </label>
        
        <label className={`reg-radio-card reg-radio-guest ${draft.isIiit === 'no' ? 'selected' : ''}`}>
          <input type="radio" checked={draft.isIiit === 'no'} onChange={() => updateDraft({ isIiit: 'no' })} />
          <div className="reg-radio-content">
            <span className="reg-radio-dot"></span>
            Guest
          </div>
          <div className="reg-radio-illustration guest-illus"></div>
        </label>
      </div>

      {error && <div className="reg-error">{error}</div>}
      <div className="reg-actions">
        {draft.isIiit && <button className="reg-btn-continue" onClick={nextStage}>CONTINUE &rarr;</button>}
      </div>
    </div>
  )
}

function DetailsStep({ draft, updateDraft, nextStage, prevStage, error }: any) {
  return (
    <div className="reg-details">
      <h3 className="reg-h3">YOUR DETAILS</h3>
      <p className="reg-p">Tell us a bit about yourself</p>

      <div className="reg-grid">
        <div className="reg-field">
          <label>Full Name *</label>
          <div className="reg-input-wrapper">
             <img src="/mahalaya_registration_assets/23_input_text.png" className="reg-input-bg" alt=""/>
             <input value={draft.fullName} onChange={e => updateDraft({ fullName: e.target.value })} />
          </div>
        </div>
        <div className="reg-field">
          <label>Email Address *</label>
          <div className="reg-input-wrapper">
             <img src="/mahalaya_registration_assets/24_input_email.png" className="reg-input-bg" alt=""/>
             <input type="email" value={draft.email} onChange={e => updateDraft({ email: e.target.value })} />
          </div>
        </div>
        <div className="reg-field">
          <label>Phone Number *</label>
          <div className="reg-input-wrapper">
             <img src="/mahalaya_registration_assets/25_input_phone.png" className="reg-input-bg" alt=""/>
             <input type="tel" value={draft.phone} onChange={e => updateDraft({ phone: e.target.value })} />
          </div>
        </div>
        <div className="reg-field">
          <label>{draft.isIiit === 'yes' ? 'IIIT Roll No. / ID *' : 'College / Organization *'}</label>
          <div className="reg-input-wrapper">
             <img src="/mahalaya_registration_assets/26_input_roll.png" className="reg-input-bg" alt=""/>
             <input value={draft.collegeId} onChange={e => updateDraft({ collegeId: e.target.value })} />
          </div>
        </div>
        {draft.isIiit === 'no' && (
          <div className="reg-field full">
            <label>City *</label>
            <div className="reg-input-wrapper">
               <img src="/mahalaya_registration_assets/23_input_text.png" className="reg-input-bg" alt=""/>
               <input value={draft.city} onChange={e => updateDraft({ city: e.target.value })} />
            </div>
          </div>
        )}
      </div>
      
      {error && <div className="reg-error">{error}</div>}
      <div className="reg-actions dual">
        <button className="reg-btn-back" onClick={prevStage}>&larr; Back</button>
        <button className="reg-btn-continue" onClick={nextStage}>CONTINUE &rarr;</button>
      </div>
    </div>
  )
}

function PassDetailsStep({ draft, updateDraft, nextStage, prevStage, error }: any) {
  return (
    <div className="reg-pass">
      <h3 className="reg-h3">YOUR PASS DETAILS</h3>
      <p className="reg-p">A few final preferences</p>
      
      <div className="reg-grid">
        <div className="reg-field">
          <label>Number of Passes *</label>
          <div className="reg-input-wrapper reg-counter">
             <img src="/mahalaya_registration_assets/19_input_quantity.png" className="reg-input-bg" alt=""/>
             <div className="reg-counter-inner">
               <button type="button" onClick={() => updateDraft({ numPasses: Math.max(1, draft.numPasses - 1) })}>&minus;</button>
               <input readOnly value={draft.numPasses} />
               <button type="button" onClick={() => updateDraft({ numPasses: Math.min(10, draft.numPasses + 1) })}>+</button>
             </div>
          </div>
        </div>
        <div className="reg-field">
          <label>Food Preference *</label>
          <div className="reg-input-wrapper">
             <img src="/mahalaya_registration_assets/20_dropdown_food.png" className="reg-input-bg" alt=""/>
             <select value={draft.foodPref} onChange={e => updateDraft({ foodPref: e.target.value })}>
               <option value="" disabled>Select option...</option>
               <option value="Non-Veg">Non-Veg (Authentic Bhoj)</option>
               <option value="Veg">Veg (Special Veg Thali)</option>
             </select>
          </div>
        </div>
      </div>
      
      {error && <div className="reg-error">{error}</div>}
      <div className="reg-actions dual">
        <button className="reg-btn-back" onClick={prevStage}>&larr; Back</button>
        <button className="reg-btn-continue" onClick={nextStage}>CONTINUE &rarr;</button>
      </div>
    </div>
  )
}

function PaymentStep({ draft, updateDraft, prevStage, total, subtotal, discount, applyCoupon, couponMsg }: any) {
  return (
    <div className="reg-payment">
      <h3 className="reg-h3">PAYMENT</h3>
      
      <div className="reg-pay-grid">
        <div className="reg-pay-box">
          <img src="/mahalaya_registration_assets/21_price_box.png" className="reg-pay-bg" alt=""/>
          <div className="reg-pay-inner">
            <span className="label">Total Amount Due</span>
            <strong className="val">{formatCurrency(total)}</strong>
          </div>
        </div>
        <div className="reg-coupon">
           <input value={draft.couponInput} onChange={e => updateDraft({ couponInput: e.target.value })} placeholder="Coupon Code" />
           <button type="button" onClick={applyCoupon}>APPLY</button>
           {couponMsg && <div>{couponMsg.text}</div>}
        </div>
      </div>

      <div className="reg-upi-section">
        <div className="reg-qr">
           <img src="/mahalaya_registration_assets/30_qr_code.png" alt="QR" />
        </div>
        <div className="reg-upi-details">
           <img src="/mahalaya_registration_assets/31_upi_id_box.png" className="reg-upi-bg" alt=""/>
           <div className="reg-upi-inner">
             <strong>{UPI_ID}</strong>
             <button onClick={() => navigator.clipboard.writeText(UPI_ID)}>COPY</button>
           </div>
        </div>
      </div>
      
      <div className="reg-actions dual">
        <button className="reg-btn-back" onClick={prevStage}>&larr; Back</button>
        <button className="reg-btn-continue" onClick={() => updateDraft({ paymentState: 'COMPLETED' })}>I HAVE MADE THE PAYMENT &rarr;</button>
      </div>
    </div>
  )
}

function PaymentCompletedStep({ draft, updateDraft, handleSubmit, loading, error, setScreenshotPreview, screenshotPreview }: any) {
  return (
    <div className="reg-payment-done">
      <h3 className="reg-h3">PAYMENT COMPLETED?</h3>
      <p className="reg-p">Enter the transaction details below</p>
      
      <div className="reg-field full">
        <label>UPI Transaction ID / UTR *</label>
        <div className="reg-input-wrapper">
             <img src="/mahalaya_registration_assets/23_input_text.png" className="reg-input-bg" alt=""/>
             <input value={draft.utr} onChange={e => updateDraft({ utr: e.target.value })} placeholder="e.g. 429810294812" />
        </div>
      </div>

      <div className="reg-upload-area">
        <img src="/mahalaya_registration_assets/27_upload_box.png" className="reg-upload-bg" alt="" />
        <input type="file" onChange={e => {
          if (e.target.files?.[0]) {
            updateDraft({ screenshot: e.target.files[0].name })
            setScreenshotPreview(URL.createObjectURL(e.target.files[0]))
          }
        }} />
        {screenshotPreview && <img src={screenshotPreview} alt="preview" className="reg-upload-preview-img"/>}
      </div>
      
      {error && <div className="reg-error">{error}</div>}
      <div className="reg-actions dual">
        <button className="reg-btn-back" onClick={() => updateDraft({ paymentState: 'READY' })}>&larr; Back</button>
        <button className="reg-btn-continue" onClick={handleSubmit} disabled={loading}>{loading ? 'PROCESSING...' : 'CONTINUE →'}</button>
      </div>
    </div>
  )
}

function ConfirmationStep({ confirmation }: any) {
  return (
    <div className="reg-confirm">
       <img src="/mahalaya_registration_assets/34_success_icon.png" alt="Success" />
       <h3 className="reg-h3">REGISTRATION RECEIVED</h3>
       <p>{confirmation?.token}</p>
       <button onClick={() => window.location.href = '/'}>GO TO HOME</button>
    </div>
  )
}
