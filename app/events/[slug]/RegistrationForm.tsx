'use client'

import { useMemo, useState, useEffect, useRef, Fragment } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import UtsavLoader from '@/components/utsav-loader'

type RegistrationFormProps = { event: any }

const UPI_ID = 'utsav.iiit@okhdfcbank'
const DRAFT_KEY = 'utsavpass_registration_draft_v4'

function formatCurrency(n: number) { return n === 0 ? 'Free' : `₹${n.toLocaleString('en-IN')}` }

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
  const [isAnimating, setIsAnimating] = useState(false)
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

  const transitionTo = (newUpdates: Partial<DraftState>) => {
    setIsAnimating(true)
    setTimeout(() => {
      updateDraft(newUpdates)
      setIsAnimating(false)
    }, 300)
  }

  const nextStage = () => {
    setError(null)
    if (draft.stage === 1 && !draft.isIiit) return setError('Select an association.')
    if (draft.stage === 2) {
      if (!draft.fullName.trim()) return setError('Enter full name.')
      if (!draft.email.includes('@')) return setError('Invalid email.')
      if (draft.phone.length < 10) return setError('Invalid phone.')
      if (draft.isIiit === 'yes' && !draft.collegeId.trim()) return setError('Enter IIIT Roll No.')
      if (draft.isIiit === 'no' && !draft.city.trim()) return setError('Enter City.')
    }
    if (draft.stage === 3 && !draft.foodPref) return setError('Select food preference.')
    if (draft.stage === 4 && draft.paymentState === 'COMPLETED') {
      if (passPrice > 0 && draft.utr.length < 6) return setError('Enter valid UTR.')
      if (passPrice > 0 && !draft.screenshot) return setError('Upload receipt.')
    }
    transitionTo({ stage: draft.stage + 1 })
  }
  const prevStage = () => { setError(null); transitionTo({ stage: draft.stage - 1 }) }

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
    if (total > 0 && draft.utr.trim().length !== 12) return setError('UTR must be exactly 12 digits.')
    if (total > 0 && !draft.screenshot) return setError('Payment screenshot is required.')

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
      transitionTo({ stage: 6 })
      localStorage.removeItem(DRAFT_KEY + '_' + event.slug)
    } catch (err: any) { setError(err.message) } finally { setLoading(false) }
  }

  if (!isLoaded) return <div>Loading...</div>

  const stepProps = { draft, updateDraft, nextStage, prevStage, error, setError, total, subtotal, discount, applyCoupon, couponMsg, handleSubmit, loading, confirmation, setScreenshotPreview, screenshotPreview, transitionTo }

  return (
    <div className="reg-shell">
      {/* Decorative Assets - Genuine Artwork Only */}
      <img src="/mahalaya_registration_assets/03_corner_top_left.png" className="reg-corner-tl" alt="" />
      <img src="/mahalaya_registration_assets/04_corner_top_right.png" className="reg-corner-tr" alt="" />
      
      {/* Bottom Landscape & Grass */}
      <div className="reg-bottom-decor">
        <img src="/mahalaya_registration_assets/11_decor_left_grass.png" className="reg-decor-grass-left" alt="" />
        <img src="/mahalaya_registration_assets/12_decor_right_grass.png" className="reg-decor-grass-right" alt="" />
        <img src="/mahalaya_registration_assets/35_decor_bottom_landscape.png" className="reg-landscape-img" alt="" />
        <img src="/mahalaya_registration_assets/36_bottom_bengali_text.png" className="reg-bengali-footer" alt="" />
      </div>

      <div className="reg-content-wrapper">
        {draft.stage < 6 && <RegistrationHeader />}
        {draft.stage < 6 && <ProgressStepper currentStage={draft.stage} />}
        {draft.stage < 6 && <img src="/mahalaya_registration_assets/06_divider_floral.png" className="reg-floral-divider" alt="" />}

        <div className={`reg-step-container ${isAnimating ? 'reg-anim-exit' : 'reg-anim-enter'}`}>
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

function TypewriterHeading({ lines }: { lines: string[] }) {
  let charCount = 0;
  return (
    <h3 className="reg-h3">
      {lines.map((line, lineIdx) => {
        const lineElements = line.split('').map((char, i) => {
          const delay = charCount * 0.03;
          charCount++;
          return (
            <span key={`${lineIdx}-${i}`} className="typewriter-char" style={{ animationDelay: `${delay}s` }}>
              {char === ' ' ? '\u00A0' : char}
            </span>
          )
        })
        return (
          <Fragment key={lineIdx}>
            {lineElements}
            {lineIdx < lines.length - 1 && <br/>}
          </Fragment>
        )
      })}
    </h3>
  )
}

function AssociationStep({ draft, updateDraft, nextStage, transitionTo, error }: any) {
  return (
    <div className="reg-association">
      <TypewriterHeading lines={['ARE YOU ASSOCIATED WITH', 'IIIT HYDERABAD?']} />
      <p className="reg-p">Students &bull; Faculty &bull; Staff &bull; Alumni</p>
      
      <div className="reg-radio-cards">
        <label className={`reg-radio-card reg-radio-community ${draft.isIiit === 'yes' ? 'selected' : ''}`}>
          <input type="radio" checked={draft.isIiit === 'yes'} onChange={() => updateDraft({ isIiit: 'yes' })} />
          <div className="reg-radio-content">
            <span className="reg-radio-dot"></span>
            Yes, IIIT Hyderabad Community
          </div>
          {/* Genuine Artwork embedded in the CSS card */}
          <div className="reg-radio-illustration building-illus">
            <img src="/mahalaya_registration_assets/09_illustration_iit_building.png" alt=""/>
          </div>
        </label>
        
        <label className={`reg-radio-card reg-radio-guest ${draft.isIiit === 'no' ? 'selected' : ''}`}>
          <input type="radio" checked={draft.isIiit === 'no'} onChange={() => updateDraft({ isIiit: 'no' })} />
          <div className="reg-radio-content">
            <span className="reg-radio-dot"></span>
            Guest
          </div>
          <div className="reg-radio-illustration guest-illus">
             <img src="/mahalaya_registration_assets/10_illustration_guest_icon.png" alt=""/>
          </div>
        </label>
      </div>

      {error && <div className="reg-error">{error}</div>}
      <div className="reg-actions">
        {draft.isIiit && <RegButton text="CONTINUE" onClick={nextStage} type="continue" />}
      </div>
    </div>
  )
}

function DetailsStep({ draft, updateDraft, nextStage, prevStage, transitionTo, error }: any) {
  return (
    <div className="reg-details">
      <TypewriterHeading lines={['YOUR DETAILS']} />
      <p className="reg-p">Tell us a bit about yourself</p>

      <div className="reg-grid">
        <div className="reg-field">
          <label>Full Name *</label>
          <input className="reg-input" value={draft.fullName} onChange={e => updateDraft({ fullName: e.target.value })} placeholder="Enter your full name" />
        </div>
        <div className="reg-field">
          <label>Email Address *</label>
          <input className="reg-input" type="email" value={draft.email} onChange={e => updateDraft({ email: e.target.value })} placeholder="your.email@iiit.ac.in" />
        </div>
        <div className="reg-field">
          <label>Phone Number *</label>
          <div className="reg-phone-wrapper">
             <span className="reg-phone-prefix">+91</span>
             <input className="reg-input" type="tel" value={draft.phone} onChange={e => updateDraft({ phone: e.target.value })} placeholder="Enter your phone number" />
          </div>
        </div>
        <div className="reg-field">
          <label>{draft.isIiit === 'yes' ? 'IIIT Roll No. / ID *' : 'City *'}</label>
          <input 
            className="reg-input" 
            value={draft.isIiit === 'yes' ? draft.collegeId : draft.city} 
            onChange={e => draft.isIiit === 'yes' ? updateDraft({ collegeId: e.target.value }) : updateDraft({ city: e.target.value })} 
            placeholder={draft.isIiit === 'yes' ? 'e.g. 2023CSB0101' : 'City'} 
          />
        </div>
      </div>
      
      {error && <div className="reg-error">{error}</div>}
      <div className="reg-actions dual">
        <RegButton text="BACK" onClick={prevStage} type="back" />
        <RegButton text="CONTINUE" onClick={nextStage} type="continue" />
      </div>
    </div>
  )
}

function PassDetailsStep({ draft, updateDraft, nextStage, prevStage, error }: any) {
  return (
    <div className="reg-pass">
      <TypewriterHeading lines={['CHOOSE YOUR PASS']} />
      <p className="reg-p">Select your meal preference</p>
      
      <div className="reg-grid">
        <div className="reg-field">
          <label>Number of Passes *</label>
          <div className="reg-counter">
             <button type="button" onClick={() => updateDraft({ numPasses: Math.max(1, draft.numPasses - 1) })}>&minus;</button>
             <span className="reg-counter-val">{draft.numPasses}</span>
             <button type="button" onClick={() => updateDraft({ numPasses: Math.min(10, draft.numPasses + 1) })}>+</button>
          </div>
        </div>
        <div className="reg-field">
          <label>Food Preference *</label>
          <select className="reg-input" value={draft.foodPref} onChange={e => updateDraft({ foodPref: e.target.value })}>
            <option value="" disabled>Select option...</option>
            <option value="Non-Veg">Non-Veg (Authentic Bhoj)</option>
            <option value="Veg">Veg (Special Veg Thali)</option>
          </select>
        </div>
      </div>
      
      {error && <div className="reg-error">{error}</div>}
      <div className="reg-actions dual">
        <RegButton text="BACK" onClick={prevStage} type="back" />
        <RegButton text="CONTINUE" onClick={nextStage} type="continue" />
      </div>
    </div>
  )
}

function RegButton({ text, onClick, type = 'continue', disabled = false, style, loadingText }: any) {
  const isBack = type === 'back';
  const baseClass = type === 'home' ? 'reg-btn-home' : `reg-btn-${type}`;
  const className = `${baseClass} hover-btn ${isBack ? 'left' : 'right'}`;
  const displayText = disabled && loadingText ? loadingText : text;
  
  return (
    <button className={className} onClick={onClick} disabled={disabled} style={style}>
      <div className="hover-btn-dot"></div>
      <span className="hover-btn-text-idle">{displayText}</span>
      <div className="hover-btn-text-hover">
        {isBack ? <>&larr; <span>{displayText}</span></> : <><span>{displayText}</span> &rarr;</>}
      </div>
    </button>
  )
}

function ReelColumn({ targetDigit, colIndex, cellHeight = 22 }: { targetDigit: number, colIndex: number, cellHeight?: number }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement>(null);
  const [currentOffset, setCurrentOffset] = useState(targetDigit);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const strip = stripRef.current;
    if (!strip) return;

    strip.style.transition = 'none';
    const startOffset = currentOffset % 10; 
    strip.style.transform = `translateY(-${startOffset * cellHeight}px)`;

    void strip.offsetHeight;

    const spins = 2;
    const finalOffset = (spins * 10) + targetDigit;
    const stagger = colIndex * 90;
    const duration = 1400;

    strip.style.transition = `transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${stagger}ms`;
    strip.style.transform = `translateY(-${finalOffset * cellHeight}px)`;
    
    let startTime: number | null = null;
    const maxBlur = 3;
    const animateBlur = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      
      if (elapsed < stagger) {
        requestAnimationFrame(animateBlur);
        return;
      }
      
      const progress = (elapsed - stagger) / duration;
      if (progress < 1) {
        const currentBlur = progress < 0.2 ? maxBlur * (progress / 0.2) : maxBlur * (1 - ((progress - 0.2) / 0.8));
        if (blurRef.current) blurRef.current.setAttribute('stdDeviation', `0 ${Math.max(0, currentBlur)}`);
        requestAnimationFrame(animateBlur);
      } else {
        if (blurRef.current) blurRef.current.setAttribute('stdDeviation', `0 0`);
      }
    };
    requestAnimationFrame(animateBlur);

    setCurrentOffset(finalOffset);

  }, [targetDigit, colIndex, cellHeight]);

  const stripNumbers = Array.from({ length: 30 }, (_, i) => i % 10);

  return (
    <div className="t-reel-col">
      <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }}>
        <filter id={`reel-blur-${colIndex}`}>
          <feGaussianBlur ref={blurRef} stdDeviation="0 0" />
        </filter>
      </svg>
      <div 
        ref={stripRef}
        className="t-reel-strip" 
        style={{ 
          transform: `translateY(-${(currentOffset % 10) * cellHeight}px)`,
          filter: `url(#reel-blur-${colIndex})`
        }}
      >
        {stripNumbers.map((num, i) => (
          <div key={i} className="t-reel-digit">{num}</div>
        ))}
      </div>
    </div>
  )
}

function SpinningCounter({ value }: { value: number }) {
  const strVal = value.toString();
  return (
    <div className="t-reel">
      <span style={{marginRight: '2px', height: '22px', display: 'flex', alignItems: 'center'}}>₹</span>
      {strVal.split('').map((char, i) => {
        if (isNaN(parseInt(char))) {
          return <span key={i} className="t-reel-digit" style={{width: 'auto'}}>{char}</span>
        }
        return <ReelColumn key={`${i}-${strVal.length}`} targetDigit={parseInt(char, 10)} colIndex={i} />
      })}
    </div>
  )
}

function PaymentStep({ draft, updateDraft, prevStage, transitionTo, total, subtotal, discount, applyCoupon, couponMsg }: any) {
  const [copied, setCopied] = useState(false)
  const UPI_ID = "utsavpass@oksbi"
  const deepLink = `upi://pay?pa=${UPI_ID}&pn=BongioSomiti&am=${total}&cu=INR`
  
  const handleCopy = () => {
    navigator.clipboard.writeText(UPI_ID)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="reg-payment">
      <TypewriterHeading lines={['PAYMENT']} />
      <p className="reg-p" style={{marginBottom: '4px', marginTop: '-4px'}}>Complete the payment and confirm below</p>
      
      <div className="reg-pay-top">
        <div className="reg-pay-box amount-box">
          <span className="amount-label">Total Amount Due</span>
          <div className="amount-val-wrapper">
             <img src="/mahalaya_registration_assets/06_divider_floral.png" className="tiny-floral" alt=""/>
             <strong className="amount-val"><SpinningCounter value={total} /></strong>
             <img src="/mahalaya_registration_assets/06_divider_floral.png" className="tiny-floral flip" alt=""/>
          </div>
        </div>
        
        <div className="reg-pay-box coupon-box">
           <span className="coupon-label">Coupon code</span>
           <div className="coupon-input-row">
             <input className="reg-input" value={draft.couponInput} onChange={e => updateDraft({ couponInput: e.target.value })} placeholder="" />
             <button type="button" className="reg-btn-apply" onClick={applyCoupon}>APPLY</button>
           </div>
           {couponMsg && <div className={`reg-coupon-msg ${couponMsg.type}`}>
               {couponMsg.type === 'success' ? '✓ ' : ''}{couponMsg.text}
           </div>}
           <div className="coupon-breakdown">
             <div className="breakdown-row"><span className="label">Original Amount</span><span className="val">₹{subtotal}</span></div>
             <div className="breakdown-row"><span className="label">&bull; Discount</span><span className="val discount">- ₹{discount}</span></div>
             <div className="breakdown-row final"><span className="label">Final Amount</span><span className="val">₹{total}</span></div>
           </div>
        </div>
      </div>

      <div className="reg-pay-bottom">
        <div className="reg-pay-box upi-box">
          <span className="upi-label">Pay via UPI</span>
          <div className="upi-qr-row">
             <div className="reg-qr">
               <QRCodeSVG value={deepLink} size={76} />
             </div>
             <div className="upi-details-col">
               <span className="scan-label">Scan the QR code or use the UPI ID below</span>
               <div className="upi-copy-row">
                 <input className="reg-input readonly" value={UPI_ID} readOnly />
                 <button className="reg-btn-copy" onClick={handleCopy}>{copied ? 'COPIED' : 'COPY'}</button>
               </div>
               <a href={deepLink} className="upi-deeplink-btn">
                 <span className="deeplink-btn-text">PAY NOW VIA UPI</span>
                 <div className="upi-icons-prominent">
                    <img src="/mahalaya_registration_assets/37_upi_gpay.png" alt="GPay"/>
                    <img src="/mahalaya_registration_assets/38_upi_phonepe.png" alt="PhonePe"/>
                    <img src="/mahalaya_registration_assets/39_upi_paytm.png" alt="Paytm"/>
                 </div>
               </a>
             </div>
          </div>
        </div>

        <div className="reg-pay-box steps-box">
          <span className="steps-label">Steps to complete:</span>
          <ol className="reg-steps-list">
            <li><span>Scan or copy UPI ID</span></li>
            <li><span>Make the payment</span></li>
            <li><span>Return here</span></li>
            <li><span>Enter UTR and upload receipt</span></li>
          </ol>
        </div>
      </div>
      
      <div className="reg-actions dual" style={{marginTop: 'auto', paddingTop: '4px'}}>
        <RegButton text="BACK" onClick={prevStage} type="back" />
        <RegButton text="I HAVE MADE THE PAYMENT" onClick={() => transitionTo({ paymentState: 'COMPLETED' })} type="continue" style={{width: 'auto', padding: '0 16px'}} />
      </div>
    </div>
  )
}

function PaymentCompletedStep({ prevStage, handleSubmit, draft, updateDraft, transitionTo, error, loading, setScreenshotPreview, screenshotPreview }: any) {
  return (
    <div className="reg-payment-done" style={{ position: 'relative' }}>
      {loading && <UtsavLoader inline={true} message="PROCESSING YOUR REGISTRATION..." />}
      <TypewriterHeading lines={['VERIFYING PAYMENT']} />
      <p className="reg-p">Please provide your transaction details</p>
      
      <div className="reg-field full">
        <label>UPI Transaction ID / UTR *</label>
        <input className="reg-input" value={draft.utr} onChange={e => updateDraft({ utr: e.target.value })} placeholder="e.g. 429810294812" />
      </div>

      <div className="reg-field full" style={{ marginTop: '2cqw' }}>
        <label>Payment Receipt *</label>
        <div className="reg-upload-area">
          <input type="file" id="receipt-upload" className="reg-file-input" accept="image/*" onChange={e => {
            if (e.target.files?.[0]) {
              updateDraft({ screenshot: e.target.files[0].name })
              setScreenshotPreview(URL.createObjectURL(e.target.files[0]))
            }
          }} />
          {!screenshotPreview ? (
            <label htmlFor="receipt-upload" className="reg-upload-label">
              <span className="upload-icon">📁</span>
              <span className="upload-text">Upload payment screenshot<br/><small>Choose File</small></span>
            </label>
          ) : (
            <div className="reg-upload-preview">
               <img src={screenshotPreview} alt="preview" className="reg-upload-preview-img"/>
               <div className="reg-upload-actions">
                  <label htmlFor="receipt-upload" className="reg-btn-change">Change</label>
                  <button type="button" className="reg-btn-remove" onClick={() => { updateDraft({ screenshot: null }); setScreenshotPreview(null) }}>Remove</button>
               </div>
            </div>
          )}
        </div>
      </div>
      
      {error && <div className="reg-error">{error}</div>}
      <div className="reg-actions dual">
        <RegButton text="BACK" onClick={() => transitionTo({ paymentState: 'READY' })} type="back" />
        <RegButton text="SUBMIT" onClick={handleSubmit} disabled={loading} loadingText="PROCESSING..." type="continue" />
      </div>
    </div>
  )
}

function ConfirmationStep({ confirmation }: any) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(confirmation?.token || 'MBH-ID')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="reg-confirm">
       {/* Genuine Artwork: Success Icon */}
       <img src="/mahalaya_registration_assets/34_success_icon.png" alt="Success" className="reg-success-icon" />
       
       <TypewriterHeading lines={['REGISTRATION', 'SUCCESSFUL!']} />
       <div className="reg-verify-msg">
          <p>Your payment is awaiting verification.</p>
          <p>Once verified, your digital pass will be sent to your registered email address.</p>
       </div>
       
       <div className="reg-id-box">
          <span className="id-label">Registration ID</span>
          <div className="id-val-row">
             <strong className="id-val">{confirmation?.token || 'MBH-2026-0842'}</strong>
             <button className="reg-btn-copy-small" onClick={handleCopy}>{copied ? '✓' : 'COPY'}</button>
          </div>
       </div>

       <RegButton text="GO TO HOME" onClick={() => window.location.href = '/'} type="home" />
    </div>
  )
}
