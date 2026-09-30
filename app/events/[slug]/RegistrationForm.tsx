'use client'

import { useMemo, useState, useEffect, useRef, Fragment } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import UtsavLoader from '@/components/utsav-loader'
import {
  checkReceiptDetails,
  isValidUtr,
  normaliseUpi,
  normaliseUtr,
} from '@/utils/payments/receipt-gate'
// The same rule the register route applies, so the form and the server cannot
// disagree about what counts as an institute address.
import { isIiitEmail } from '@/utils/email-verification'
// ...and the same one it prices with, for the same reason.
import { audienceFor, groupByMeal, keyOf, priceOf, quote, type PassType } from '@/utils/pricing'

type RegistrationFormProps = { event: any }

const UPI_ID = 'utsav.iiit@okhdfcbank'
const DRAFT_KEY = 'bangiya.samiti.iiith_registration_draft_v4'

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
  vegCount: number
  nonVegCount: number
  passSelections: Record<string, number>
  couponInput: string
  /** `subtotal` is the basket the discount was worked out on; see staleCoupon. */
  appliedCoupon: { code: string; discount: number; subtotal: number } | null
  selectedUpiId: string
  utr: string
  receiverUpi: string
  // Where /api/receipts put the uploaded image. Sent with the registration.
  receiptPath: string
  // Whether each value was read off the receipt rather than typed. A read value
  // is shown but not editable: the visitor is confirming what the receipt says,
  // not restating it.
  utrFromOcr: boolean
  receiverUpiFromOcr: boolean
  screenshot: string | null
  stage: number
  paymentState: 'READY' | 'COMPLETED'
  // --- email OTP ---------------------------------------------------------
  // The signed receipt /api/verify-email hands back once the mailed code comes
  // back, and the address it was issued for. They are kept as a pair because a
  // proof is bound to one address: change the field and the proof is void, so
  // the comparison is what stops a verified address being swapped for another.
  emailProof: string
  verifiedEmail: string
  otpSent: boolean
  otpInput: string
}

const DEFAULT_DRAFT: DraftState = {
  isIiit: null, fullName: '', email: '', phone: '', collegeId: '', city: '',
  numPasses: 1, foodPref: '', vegCount: 0, nonVegCount: 1, passSelections: {}, couponInput: '', appliedCoupon: null,
  selectedUpiId: '', utr: '', receiverUpi: '', receiptPath: '',
  utrFromOcr: false, receiverUpiFromOcr: false,
  screenshot: null, stage: 1, paymentState: 'READY',
  emailProof: '', verifiedEmail: '', otpSent: false, otpInput: ''
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

  // The UPI ids this festival collects at - one per manager. What the OCR reads
  // off a receipt is checked against these, so a receipt naming somebody else's
  // handle cannot be filed as a payment to the festival.
  const [allowedUpiIds, setAllowedUpiIds] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    fetch(`/api/upi-ids?event=${encodeURIComponent(event.slug)}`)
      .then((r) => (r.ok ? r.json() : { upiIds: [] }))
      .then((d) => { if (!cancelled) setAllowedUpiIds(Array.isArray(d.upiIds) ? d.upiIds : []) })
      .catch(() => { /* the same gate runs on the server */ })

    return () => { cancelled = true }
  }, [event.slug])

  /**
   * Every registration starts at step 1, with nothing carried over.
   *
   * The draft used to be written to localStorage on every keystroke and read
   * back on mount - stage included - so returning to the page dropped the
   * visitor wherever they had stopped, which was step 4 for anyone who had
   * reached the payment screen once. Worse than confusing: the stored draft
   * also held utr, receiptPath, receiverUpi and paymentState, so a stale
   * transaction id and somebody's earlier receipt sat in the form waiting to
   * be submitted against a new booking.
   *
   * Nothing is written any more, and whatever a previous version left behind
   * is cleared here - for every event, not just this one, since the key was
   * per slug and a visitor may have drafts under several.
   */
  useEffect(() => {
    try {
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i)
        if (key && key.startsWith(DRAFT_KEY)) localStorage.removeItem(key)
      }
    } catch (e) {}
    setIsLoaded(true)
  }, [event.slug])

  const updateDraft = (u: Partial<DraftState>) => setDraft(p => ({ ...p, ...u }))

  /**
   * The email OTP.
   *
   * Asking for a code and checking it both go to /api/verify-email; checking
   * returns a signed proof that travels with the registration and is checked
   * again there. Nothing here decides anything - the form cannot verify an
   * address, it can only carry the server's word for it.
   */
  const [otpBusy, setOtpBusy] = useState(false)
  const [otpNote, setOtpNote] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const emailIsVerified =
    Boolean(draft.emailProof) && draft.verifiedEmail === draft.email.trim().toLowerCase()

  async function sendOtp() {
    const email = draft.email.trim().toLowerCase()
    if (!email.includes('@')) { setOtpNote({ type: 'error', text: 'Enter your email address first.' }); return }

    // Checked before a code is sent, not after it comes back. Someone claiming
    // the institute rate on a personal address would otherwise verify it
    // happily and only be refused at the end of the form - having spent a code
    // out of the day's allowance to be told so.
    if (draft.isIiit === 'yes' && !isIiitEmail(email)) {
      setOtpNote({
        type: 'error',
        text: 'Use your institute address — name@students.iiit.ac.in, or research, staff, faculty, alumni, or plain iiit.ac.in. If you are not from IIIT Hyderabad, please go back and register as a guest.',
      })
      return
    }

    setOtpBusy(true)
    setOtpNote(null)
    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not send the code.')
      updateDraft({ otpSent: true, otpInput: '' })
      setOtpNote({ type: 'success', text: `Code sent to ${email}. It is good for 10 minutes.` })
    } catch (e: any) {
      setOtpNote({ type: 'error', text: e.message })
    } finally {
      setOtpBusy(false)
    }
  }

  async function checkOtp() {
    const email = draft.email.trim().toLowerCase()
    setOtpBusy(true)
    setOtpNote(null)
    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: draft.otpInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'That code is not right.')
      updateDraft({ emailProof: data.proof, verifiedEmail: email, otpSent: false, otpInput: '' })
      // No note on success: once emailIsVerified is true the field shows a
      // standing "✓ Email confirmed", and setting a note here put the same
      // sentence on the screen twice.
      setOtpNote(null)
    } catch (e: any) {
      setOtpNote({ type: 'error', text: e.message })
    } finally {
      setOtpBusy(false)
    }
  }

  /** Editing the address voids the proof, which was issued for the old one. */
  function onEmailChange(value: string) {
    updateDraft({
      email: value,
      ...(draft.emailProof && value.trim().toLowerCase() !== draft.verifiedEmail
        ? { emailProof: '', verifiedEmail: '', otpSent: false, otpInput: '' }
        : {}),
    })
    setOtpNote(null)
  }

  const transitionTo = (newUpdates: Partial<DraftState>) => {
    setIsAnimating(true)
    setTimeout(() => {
      updateDraft(newUpdates)
      setIsAnimating(false)
    }, 300)
  }

  const passTypes = event.config?.pass_types || null
  const calculatedNumPasses = passTypes ? Object.values(draft.passSelections).reduce((a, b) => a + b, 0) : draft.numPasses

  const nextStage = () => {
    setError(null)
    if (draft.stage === 1 && !draft.isIiit) return setError('Select an association.')
    if (draft.stage === 2) {
      if (!draft.fullName.trim()) return setError('Enter full name.')
      if (!draft.email.includes('@')) return setError('Invalid email.')
      if (draft.phone.length < 10) return setError('Invalid phone.')
      // The roll number is gone: affiliation is settled by the verified email
      // domain, and staff, faculty and alumni never had one to give.
      if (draft.isIiit === 'no' && !draft.city.trim()) return setError('Enter City.')
      // The address has to be confirmed, and confirmed for *this* address - the
      // proof is bound to it, so editing the field after verifying clears it.
      if (!draft.emailProof || draft.verifiedEmail !== draft.email.trim().toLowerCase()) {
        return setError('Confirm your email address first.')
      }
      if (draft.isIiit === 'yes' && !isIiitEmail(draft.email)) {
        return setError('The institute rate needs a confirmed @iiit.ac.in address — students, research, staff, faculty or alumni. Please go back and register as a guest, or use your institute email.')
      }
    }
    if (draft.stage === 3) {
      if (passTypes) {
        if (calculatedNumPasses === 0) return setError('Select at least one pass.')
      } else {
        if (draft.numPasses === 1 && !draft.foodPref) return setError('Select food preference.')
        if (draft.numPasses > 1 && (draft.vegCount + draft.nonVegCount !== draft.numPasses)) return setError(`Please distribute your ${draft.numPasses} passes among Veg and Non-Veg.`)
      }
    }
    if (draft.stage === 4 && draft.paymentState === 'COMPLETED') {
      if (total > 0 && draft.utr.length < 6) return setError('Enter valid UTR.')
      // Both halves are checked: `screenshot` is the file the visitor picked,
      // `receiptPath` is where it was actually stored. Removing the image used
      // to clear only the first, and the gate downstream reads the second - so
      // a booking could go on with a receipt nobody could open.
      if (total > 0 && (!draft.screenshot || !draft.receiptPath)) {
        return setError('Upload the payment screenshot before continuing.')
      }
      if (total > 0 && !draft.receiverUpi.trim()) return setError('Enter the UPI ID you paid to.')
    }
    transitionTo({ stage: draft.stage + 1 })
  }
  const prevStage = () => { setError(null); transitionTo({ stage: draft.stage - 1 }) }

  /**
   * Who the prices on screen are for.
   *
   * Only the confirmed address counts, which is why this reads verifiedEmail
   * rather than the field being typed into: until a code has come back, the
   * visitor is a guest here. The route decides this again from its own copy
   * of the proof, so nothing about the price rests on the browser agreeing.
   */
  const audience = useMemo(
    () => audienceFor(draft.verifiedEmail, draft.isIiit === 'yes'),
    [draft.verifiedEmail, draft.isIiit]
  )

  // The same function the register route prices with. They disagreed before -
  // the form summed each pass type, the route charged one flat rate per pass -
  // and the number people saw was not the number that was recorded.
  const subtotal = useMemo(
    () => quote(event, { selections: draft.passSelections, numPasses: draft.numPasses }, audience).subtotal,
    [event, draft.passSelections, draft.numPasses, audience]
  )
  // A discount belongs to the basket it was priced on. Only that basket gets it.
  const discount = draft.appliedCoupon && draft.appliedCoupon.subtotal === subtotal ? draft.appliedCoupon.discount : 0
  const total = Math.max(0, subtotal - discount)

  /**
   * Asks the server what the code is worth.
   *
   * This used to read event.config.coupons and decide here. A coupon can now
   * depend on the basket clearing a threshold, or on this being one of the
   * first N registrations - and the browser cannot know the second at all, or
   * be trusted about the first. So the same function the register route uses
   * answers, and the form shows whatever it says.
   */
  const applyCoupon = () => checkCoupon(draft.couponInput.trim().toUpperCase(), false)

  async function checkCoupon(code: string, recheck: boolean) {
    // An empty box is not a wrong code, and saying so sends people hunting for
    // a typo in something they never typed.
    if (!code) {
      updateDraft({ appliedCoupon: null })
      setCouponMsg({ type: 'error', text: 'Enter a coupon code first.' })
      return
    }

    // Losing a discount silently is worse than being told the new code is bad,
    // so the refusals below say which of the two just happened.
    const hadOne = Boolean(draft.appliedCoupon)
    // Captured now: if the basket moves while this is in flight, the answer is
    // stored against the old figure and staleCoupon asks again.
    const pricedOn = subtotal

    try {
      const res = await fetch(`/api/events/${event.slug}/coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal: pricedOn }),
      })
      const verdict = await res.json()

      if (verdict?.ok) {
        updateDraft({ appliedCoupon: { code: verdict.code, discount: verdict.discount, subtotal: pricedOn } })
        // The tick is added by the renderer; putting one here too printed two.
        setCouponMsg({
          type: 'success',
          text: recheck
            ? `Coupon ${verdict.code} re-checked for the new total (-₹${verdict.discount})`
            : `Coupon ${verdict.code} applied (-₹${verdict.discount})`,
        })
        return
      }

      updateDraft({ appliedCoupon: null })
      setCouponMsg({
        type: 'error',
        text: hadOne
          ? `${verdict?.reason || `"${code}" is not a valid coupon.`} The earlier discount has been removed.`
          : (verdict?.reason || `"${code}" is not a valid coupon for this event.`),
      })
    } catch {
      // A coupon that cannot be checked is not applied. The register route
      // would refuse it anyway, and showing a discount that later vanishes is
      // worse than saying the check did not happen.
      updateDraft({ appliedCoupon: null })
      setCouponMsg({ type: 'error', text: 'Could not check that coupon just now. Please try again.' })
    }
  }

  /*
    The basket changed after a coupon was applied - passes added or removed,
    or a verified address moving the price. The old discount is wrong either
    way: a percentage no longer matches, and a threshold may no longer be met.
    Nothing is taken off until the server has priced the new basket, so the
    total on screen is never one the booking will not be recorded at.

    Asked once the visitor is back on the payment step, where the discount is
    shown and paid - not on every +/- while they are still choosing passes,
    which would spend the preview endpoint's rate limit for nothing.
  */
  const staleCoupon = draft.stage >= 4 && draft.appliedCoupon && draft.appliedCoupon.subtotal !== subtotal
    ? draft.appliedCoupon.code
    : null
  useEffect(() => {
    if (staleCoupon) void checkCoupon(staleCoupon, true)
    // checkCoupon is rebuilt every render; the coupon and the basket are what
    // decide whether to ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staleCoupon, subtotal])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // The same module the register route uses, so the button and the server
    // cannot disagree about what a complete payment looks like.
  const gate = checkReceiptDetails({
      isFree: total === 0,
      utr: draft.utr,
      receiverUpi: draft.receiverUpi,
      receiptPath: draft.receiptPath,
      allowedUpiIds,
    })
    if (!gate.ok) return setError(gate.error)

    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventSlug: event.slug,
          participantName: draft.fullName,
          // Kept in the payload for older rows' sake; nothing collects it now.
          collegeId: draft.collegeId || undefined,
          phone: draft.phone,
          email: draft.email,
          // The server's own receipt for this address, spent on arrival.
          emailProof: draft.emailProof,
          utr: draft.utr || 'FREE',
          receiverUpi: draft.receiverUpi || undefined,
          receiptPath: draft.receiptPath || undefined,
          numPasses: calculatedNumPasses,
          // Sent structured as well as summarised. The summary is what goes on
          // the pass and into the admin lists; these counts are what the route
          // prices, against the event's own table rather than anything here.
          passSelections: passTypes ? draft.passSelections : undefined,
          foodPref: passTypes ? Object.entries(draft.passSelections).filter(([_, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(', ') : (draft.numPasses === 1 ? draft.foodPref : `${draft.vegCount} Veg, ${draft.nonVegCount} Non-Veg`),
          vegCount: passTypes ? undefined : (draft.numPasses === 1 ? (draft.foodPref === 'Veg' ? 1 : 0) : draft.vegCount),
          nonVegCount: passTypes ? undefined : (draft.numPasses === 1 ? (draft.foodPref === 'Non-Veg' ? 1 : 0) : draft.nonVegCount),
          isIiit: draft.isIiit === 'yes',
          couponCode: draft.appliedCoupon?.code || undefined,
          discountAmount: draft.appliedCoupon?.discount || 0
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

  const stepProps = { event, draft, updateDraft, nextStage, prevStage, error, setError, total, subtotal, discount, applyCoupon, couponMsg, setCouponMsg, handleSubmit, loading, confirmation, setScreenshotPreview, screenshotPreview, transitionTo, allowedUpiIds, sendOtp, checkOtp, onEmailChange, otpBusy, otpNote, emailIsVerified, audience }

  if (event?.status !== 'OPEN') {
    if (event?.slug !== 'mahalaya') {
      return (
        <div className="reg-shell is-locked" style={{ overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '600px', backgroundColor: '#fff8f0' }}>
          <img src="/assets/saraswati-puja.webp" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.15 }} alt="Saraswati Thakur" />
          <div className="form-lock-content" style={{ position: 'relative', zIndex: 10, background: 'rgba(255,255,255,0.9)', padding: '3rem', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
            <div className="form-lock-icon" style={{ margin: '0 auto 1.5rem', width: '64px', height: '64px', background: '#ffe4b5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d2691e' }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" width="32" height="32">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <h4 className="form-lock-title" style={{ fontSize: '1.5rem', color: '#5c4033', marginBottom: '0.5rem', textAlign: 'center' }}>Registrations Opening Soon</h4>
            <p className="form-lock-desc" style={{ color: '#8b4513', textAlign: 'center' }}>Stay tuned for updates!</p>
          </div>
        </div>
      )
    }

    return (
      <div className="reg-shell is-locked">
        {/* Decorative Assets */}
        <img src="/mahalaya_registration_assets/03_corner_top_left.png" className="reg-corner-tl" alt="" />
        <img src="/mahalaya_registration_assets/04_corner_top_right.png" className="reg-corner-tr" alt="" />
        <div className="reg-bottom-decor">
          <img src="/mahalaya_registration_assets/11_decor_left_grass.png" className="reg-decor-grass-left" alt="" />
          <img src="/mahalaya_registration_assets/12_decor_right_grass.png" className="reg-decor-grass-right" alt="" />
          <img src="/mahalaya_registration_assets/35_decor_bottom_landscape.png" className="reg-landscape-img" alt="" />
          <img src="/mahalaya_registration_assets/36_bottom_bengali_text.png" className="reg-bengali-footer" alt="" />
        </div>
        <div className="reg-content-wrapper">
          <RegistrationHeader />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '280px' }}>
            <div className="form-lock-content" style={{ position: 'relative' }}>
              <div className="form-lock-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <h4 className="form-lock-title">Registrations Opening Soon</h4>
              <p className="form-lock-desc">Stay tuned for updates!</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="reg-shell">
      {loading && <UtsavLoader inline={true} message="PROCESSING YOUR REGISTRATION..." />}
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

        {/* One notice for the card. It is rendered here, outside the step, so a
            step changing does not take the message with it, and so it floats
            over the form instead of displacing it. */}
        <FormToast
          message={
            error ? { type: 'error' as const, text: error }
            : couponMsg ? { type: couponMsg.type, text: couponMsg.text }
            : otpNote ? { type: otpNote.type, text: otpNote.text }
            : null
          }
          onDismiss={() => { setError(null); setCouponMsg(null); setOtpNote(null) }}
        />

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

      <div className="reg-actions">
        {draft.isIiit && <RegButton text="CONTINUE" onClick={nextStage} type="continue" />}
      </div>
    </div>
  )
}

function DetailsStep({ draft, updateDraft, nextStage, prevStage, transitionTo, error, sendOtp, checkOtp, onEmailChange, otpBusy, otpNote, emailIsVerified }: any) {
  const wantsIiit = draft.isIiit === 'yes'

  const nameState = fieldState(draft.fullName, {
    touched: true,
    rule: (v) => (v.length < 2 ? 'Enter your full name.' : null),
  })
  const emailState = fieldState(draft.email, {
    touched: true,
    rule: (v) => {
      if (!v.includes('@') || !v.includes('.')) return 'That does not look like an email address.'
      if (wantsIiit && !isIiitEmail(v)) return 'The institute rate needs an @iiit.ac.in address — students, research, staff, faculty or alumni.'
      if (!emailIsVerified) return 'Send yourself a code and confirm this address.'
      return null
    },
  })
  const phoneState = fieldState(draft.phone, {
    touched: true,
    rule: (v) => (v.replace(/\D/g, '').length < 10 ? 'A phone number needs 10 digits.' : null),
  })
  const cityState = fieldState(draft.city, {
    touched: true,
    rule: (v) => (v.length < 2 ? 'Enter the city you are coming from.' : null),
  })

  return (
    <div className="reg-details">
      <TypewriterHeading lines={['YOUR DETAILS']} />
      <p className="reg-p">Tell us a bit about yourself</p>

      <div className="reg-grid">
        <div className="reg-field">
          <label>Full Name *</label>
          {/* The mark is anchored to the input, not the field. The grid stretches
              every cell in a row to the tallest, and the email cell carries the
              whole OTP block - so a mark pinned to the field bottom drifted down
              beside the Send button and read as belonging to it. */}
          <span className="reg-field__control">
            <input {...fieldProps(nameState)} className={`reg-input ${fieldProps(nameState).className}`}
              value={draft.fullName} onChange={e => updateDraft({ fullName: e.target.value })} placeholder="Enter your Full Name" />
            {nameState.tone && <span className={`reg-field__mark reg-field__mark--${nameState.tone === "ok" ? "ok" : "bad"}`} aria-hidden="true">{nameState.tone === "ok" ? "✓" : "!"}</span>}
          </span>
        </div>
        <div className="reg-field">
          <label>Email Address *</label>
          <input
            type="email"
            {...fieldProps(emailState)}
            className={`reg-input ${fieldProps(emailState).className}`}
            value={draft.email}
            onChange={e => onEmailChange(e.target.value)}
            placeholder="Enter your Email Address"
            autoComplete="email"
            inputMode="email"
          />

          {/* Said before they type, not after the code has been spent. */}
          {draft.isIiit === 'yes' && (
            <span className="reg-read__note">
            </span>
          )}

          {/* The address has to be confirmed before the form moves on. For
              anyone claiming the institute rate this is also what establishes
              the claim - there is no roll number to give any more. */}
          {emailIsVerified ? (
            <p className="reg-otp-note is-ok" role="status">✓ Email confirmed</p>
          ) : (
            <div className="reg-otp">
              {!draft.otpSent ? (
                <button type="button" className="reg-otp-btn" onClick={sendOtp} disabled={otpBusy || !draft.email.includes('@')}>
                  {otpBusy ? 'Sending…' : 'Send confirmation code'}
                </button>
              ) : (
                <div className="reg-otp-row">
                  <input
                    className="reg-input reg-otp-input"
                    value={draft.otpInput}
                    onChange={e => updateDraft({ otpInput: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    placeholder="Enter Confirmation Code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                  />
                  <button type="button" className="reg-otp-btn" onClick={checkOtp} disabled={otpBusy || draft.otpInput.length !== 6}>
                    {otpBusy ? 'Checking…' : 'Confirm'}
                  </button>
                  <button type="button" className="reg-otp-link" onClick={sendOtp} disabled={otpBusy}>
                    Resend
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
        <div className="reg-field">
          <label>Phone Number *</label>
          <div className="reg-phone-wrapper">
             <span className="reg-phone-prefix">+91</span>
             <input {...fieldProps(phoneState)} className={`reg-input ${fieldProps(phoneState).className}`}
               type="tel" value={draft.phone} onChange={e => updateDraft({ phone: e.target.value })} placeholder="Enter your Phone Number" />
          </div>
        </div>
        {/* No roll number. A confirmed @iiit.ac.in address is what establishes
            the institute rate now, and it covers staff, faculty and alumni,
            who were never issued a roll number and could not fill this in. */}
        {draft.isIiit === 'no' && (
          <div className="reg-field">
            <label>City *</label>
            <input
              {...fieldProps(cityState)}
              className={`reg-input ${fieldProps(cityState).className}`}
              value={draft.city}
              onChange={e => updateDraft({ city: e.target.value })}
              placeholder="Enter your City"
            />
          </div>
        )}
      </div>
      
      <div className="reg-actions dual">
        <RegButton text="BACK" onClick={prevStage} type="back" />
        <RegButton text="CONTINUE" onClick={nextStage} type="continue" />
      </div>
    </div>
  )
}

function PassDetailsStep({ event, draft, updateDraft, nextStage, prevStage, error, audience }: any) {
  const passTypes: PassType[] | null = event.config?.pass_types || null

  /*
    Pass types carrying a `meal` are shown as a section each - Breakfast beside
    Lunch - with the same Veg and Non-Veg counters in both. Anything without
    one falls into a single unnamed section, which is how an event configured
    before the split still renders as the one list it always was.

    The price shown is the one this visitor pays and no other. There is no
    "student rate" label and no struck-through comparison anywhere on the page:
    somebody paying the guest price has no way to tell from this screen that
    another price exists.
  */
  const sections = passTypes ? groupByMeal(passTypes) : []
  const totalChosen = Object.values(draft.passSelections as Record<string, number>)
    .reduce((a: number, b: number) => a + b, 0)

  const setCount = (name: string, next: number) =>
    updateDraft({ passSelections: { ...draft.passSelections, [name]: next } })

  return (
    <div className="reg-pass">
      <TypewriterHeading lines={['CHOOSE YOUR PASS']} />
      <p className="reg-p">Select your pass and meal preference</p>

      <div className="reg-grid">
        {passTypes ? (
          <div className="reg-field" style={{ gridColumn: '1 / -1' }}>
            <label>Select Passes *</label>
            <div className="reg-meal-sections">
              {sections.map((section) => (
                <div className="reg-meal-section" key={section.meal ?? 'all'}>
                  {section.meal && <span className="reg-meal-title">{section.meal}</span>}
                  <div className="reg-meal-counters">
                    {section.types.map((pt) => {
                      // Keyed by meal+name, so "Veg" under Breakfast and
                      // "Veg" under Lunch are two counters, not one.
                      const key = keyOf(pt)
                      const count = draft.passSelections[key] || 0
                      const each = priceOf(pt, audience)
                      return (
                        <div className="reg-plate" key={pt.name}>
                          <div className="reg-counter-row">
                            <span className="reg-counter-label">
                              <span className="reg-plate-name">{pt.name}</span>
                              {/* The price of one plate, said plainly rather than
                                  left to be worked out at the payment step. */}
                              <span className="reg-plate-price">
                                {each > 0 ? `${formatCurrency(each)} each` : 'Free'}
                              </span>
                            </span>
                            <div className="reg-counter">
                              <button type="button" aria-label={`One fewer ${pt.name}`}
                                onClick={() => setCount(key, Math.max(0, count - 1))}>&minus;</button>
                              <span className="reg-counter-val">{count}</span>
                              <button type="button" aria-label={`One more ${pt.name}`}
                                onClick={() => { if (totalChosen < 10) setCount(key, count + 1) }}>+</button>
                            </div>
                          </div>
                          {/* The running sum for this plate, on a line of its own
                              under the whole row: beside the counter the label
                              can be under 70px wide, and the sum used to break
                              mid-equation there. */}
                          {count > 0 && each > 0 && (
                            <span className="reg-plate-line">
                              {count} × {formatCurrency(each)} = {formatCurrency(count * each)}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* What the chosen plates come to. The payment step showed the
                first figure until now, which meant adding up plate prices in
                your head to know what you were agreeing to. Same function the
                payment step and the register route use, so all three agree. */}
            {totalChosen > 0 && (
              <div className="reg-plate-total">
                <span>{totalChosen} {totalChosen === 1 ? 'plate' : 'plates'}</span>
                <strong>{formatCurrency(quote(event, { selections: draft.passSelections }, audience).subtotal)}</strong>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="reg-field">
              <label>Number of Passes *</label>
              <div className="reg-counter">
                 <button type="button" onClick={() => {
                   const newNum = Math.max(1, draft.numPasses - 1)
                   updateDraft({ numPasses: newNum, vegCount: 0, nonVegCount: newNum })
                 }}>&minus;</button>
                 <span className="reg-counter-val">{draft.numPasses}</span>
                 <button type="button" onClick={() => {
                   const newNum = Math.min(10, draft.numPasses + 1)
                   updateDraft({ numPasses: newNum, vegCount: 0, nonVegCount: newNum })
                 }}>+</button>
              </div>
            </div>
            <div className="reg-field">
              <label>Food Preference *</label>
              {draft.numPasses === 1 ? (
                <select className="reg-input" value={draft.foodPref} onChange={e => updateDraft({ foodPref: e.target.value })}>
                  <option value="" disabled>Select option...</option>
                  {event?.config?.food_preferences?.length > 0 ? (
                    event.config.food_preferences.map((pref: string) => (
                      <option key={pref} value={pref}>{pref}</option>
                    ))
                  ) : (
                    <>
                      <option value="Non-Veg">Non-Veg (Authentic Bhoj)</option>
                      <option value="Veg">Veg (Special Veg Thali)</option>
                    </>
                  )}
                </select>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="reg-counter-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="reg-counter-label">Veg Passes</span>
                    <div className="reg-counter">
                       <button type="button" onClick={() => {
                         const newVeg = Math.max(0, draft.vegCount - 1)
                         updateDraft({ vegCount: newVeg, nonVegCount: draft.numPasses - newVeg })
                       }}>&minus;</button>
                       <span className="reg-counter-val">{draft.vegCount}</span>
                       <button type="button" onClick={() => {
                         const newVeg = Math.min(draft.numPasses, draft.vegCount + 1)
                         updateDraft({ vegCount: newVeg, nonVegCount: draft.numPasses - newVeg })
                       }}>+</button>
                    </div>
                  </div>
                  <div className="reg-counter-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="reg-counter-label">Non-Veg Passes</span>
                    <div className="reg-counter">
                       <button type="button" onClick={() => {
                         const newNon = Math.max(0, draft.nonVegCount - 1)
                         updateDraft({ nonVegCount: newNon, vegCount: draft.numPasses - newNon })
                       }}>&minus;</button>
                       <span className="reg-counter-val">{draft.nonVegCount}</span>
                       <button type="button" onClick={() => {
                         const newNon = Math.min(draft.numPasses, draft.nonVegCount + 1)
                         updateDraft({ nonVegCount: newNon, vegCount: draft.numPasses - newNon })
                       }}>+</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      <div className="reg-actions dual">
        <RegButton text="BACK" onClick={prevStage} type="back" />
        <RegButton text="CONTINUE" onClick={nextStage} type="continue" />
      </div>
    </div>
  )
}

/**
 * The card's one place for saying something went right or wrong.
 *
 * It floats over the form rather than sitting in it. Inserting a message into
 * the flow pushed every field below it down, which meant being told about a
 * mistake moved the box you were about to fix - worst at the moment you were
 * already reaching for it. This occupies no layout at all, animates in, and
 * clears itself.
 *
 * It is deliberately not the only signal: the field that caused it carries a
 * border and a mark of its own, and the reason is on its tooltip. This is for
 * noticing; the field is for locating.
 */
/**
 * What a field should look like, and what it should say on hover.
 *
 * Returned together so a field cannot end up outlined red with no explanation,
 * or explained with no outline. `tone` is null while a field is untouched -
 * nothing is wrong with a box nobody has typed in yet, and colouring it before
 * then just makes the form look like a list of complaints.
 */
function fieldState(value: string, opts: { touched: boolean; rule?: (v: string) => string | null }) {
  const v = (value || '').trim()
  if (!opts.touched || v === '') return { tone: null as null | 'ok' | 'bad', tip: undefined as string | undefined }
  const problem = opts.rule ? opts.rule(v) : null
  return problem
    ? { tone: 'bad' as const, tip: problem }
    : { tone: 'ok' as const, tip: undefined }
}

/** The class and hover text a field carries, from a fieldState result. */
function fieldProps(state: { tone: null | 'ok' | 'bad'; tip?: string }) {
  return {
    className: state.tone === 'ok' ? 'is-valid' : state.tone === 'bad' ? 'is-invalid' : '',
    ...(state.tip ? { 'data-tip': state.tip, 'data-tip-pos': 'top' } : {}),
  }
}

function FormToast({ message, onDismiss }: {
  message: { type: 'error' | 'success'; text: string } | null
  onDismiss: () => void
}) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!message) return
    setLeaving(false)
    // Errors stay until dismissed or superseded; good news does not need to.
    if (message.type !== 'success') return
    const fade = setTimeout(() => setLeaving(true), 2600)
    const gone = setTimeout(onDismiss, 2900)
    return () => { clearTimeout(fade); clearTimeout(gone) }
  }, [message, onDismiss])

  if (!message) return null

  return (
    <div className="reg-toast-layer" aria-live="polite" aria-atomic="true">
      <div className={`reg-toast reg-toast--${message.type} ${leaving ? 'is-leaving' : ''}`} role="status">
        <span className="reg-toast__icon" aria-hidden="true">{message.type === 'success' ? '✓' : '!'}</span>
        <span>{message.text}</span>
        <button type="button" className="reg-toast__close" onClick={onDismiss} aria-label="Dismiss">×</button>
      </div>
    </div>
  )
}

function RegButton({ text, onClick, type = 'continue', disabled = false, loading = false, style, loadingText }: any) {
  const isBack = type === 'back';
  const baseClass = type === 'home' ? 'reg-btn-home' : `reg-btn-${type}`;
  const className = `${baseClass} hover-btn ${isBack ? 'left' : 'right'}`;
  // Only while something is actually in flight. This used to key off `disabled`,
  // and SUBMIT is disabled for two quite different reasons - a request running,
  // or a form not yet complete - so an unfinished form sat there claiming to be
  // PROCESSING... before anyone had pressed anything.
  const displayText = loading && loadingText ? loadingText : text;

  return (
    <button className={className} onClick={onClick} disabled={disabled || loading} style={style}>
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

function PaymentStep({ event, draft, updateDraft, prevStage, transitionTo, total, subtotal, discount, applyCoupon, couponMsg, setCouponMsg, allowedUpiIds }: any) {
  const [copied, setCopied] = useState(false)
  // One UPI id per manager, so adding a manager adds a way to pay: the id in
  // the list and the QR beside it, which is generated from whichever id is
  // selected. Falls back to the event's own configured ids while no manager
  // profiles exist.
  const upiIds = (allowedUpiIds && allowedUpiIds.length > 0)
    ? allowedUpiIds
    : (event?.config?.upi_ids || (event?.config?.upi_id ? [event.config.upi_id] : ["bangiya.samiti.iiith@oksbi"]))
  const activeUpiId = upiIds.includes(draft.selectedUpiId) ? draft.selectedUpiId : upiIds[0]
  const deepLink = `upi://pay?pa=${activeUpiId}&pn=BangiyaSomiti&am=${total}&cu=INR`
  
  const handleCopy = () => {
    navigator.clipboard.writeText(activeUpiId)
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
             {/* onChange clears couponMsg: a verdict on the previous
                 code says nothing about the one being typed now. */}
             <input
               className={`reg-input ${couponMsg?.type === 'error' ? 'reg-coupon-input is-invalid' : ''}`}
               value={draft.couponInput}
               onChange={e => { updateDraft({ couponInput: e.target.value }); setCouponMsg(null) }}
               onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon() } }}
               placeholder="Enter Coupon Code"
               aria-invalid={couponMsg?.type === 'error'}
             />
             <button type="button" className="reg-btn-apply" onClick={applyCoupon}>APPLY</button>
           </div>
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
               <QRCodeSVG value={deepLink} size={54} />
             </div>
             <div className="upi-details-col">
               <span className="scan-label">Scan the QR code or use the UPI ID below</span>
               <div className="upi-copy-row">
                 {upiIds.length > 1 ? (
                   <select className="reg-input" style={{ padding: '0 8px' }} value={activeUpiId} onChange={e => updateDraft({ selectedUpiId: e.target.value })}>
                     {upiIds.map((id: string) => <option key={id} value={id}>{id}</option>)}
                   </select>
                 ) : (
                   <input className="reg-input readonly" value={activeUpiId} readOnly />
                 )}
                 <button className="reg-btn-copy" onClick={handleCopy}>{copied ? 'COPIED' : 'COPY'}</button>
               </div>
               {/* The list arrives least-used first, so the top entry is the one that
                   spreads the load. Saying so turns an invisible ordering into
                   something people can choose to go along with. */}
               {upiIds.length > 1 && (
                 <p className="upi-advisory">
                   Please use the IDs in the order shown — the one at the top has taken the
                   fewest payments so far, and using it helps us verify everyone&rsquo;s
                   registration faster.
                 </p>
               )}
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

        {/* These describe what the screen actually asks for now, which had
            drifted. There is a list of ids to choose from rather than one to
            copy, the way back is a named button, and the receipt is what
            carries the transaction id - it is read off the image, and typing
            it is the fallback, not the instruction. */}
        <div className="reg-pay-box steps-box">
          <span className="steps-label">Steps to complete:</span>
          <ol className="reg-steps-list">
            <li><span>{upiIds.length > 1 ? 'Choose a UPI ID, then scan or copy it' : 'Scan the QR or copy the UPI ID'}</span></li>
            <li><span>Pay {formatCurrency(total)} from your UPI app</span></li>
            <li><span>Return here and tap &ldquo;I have made the payment&rdquo;</span></li>
            <li><span>Upload the receipt &mdash; the transaction ID is read from it</span></li>
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

function PaymentCompletedStep({ event, prevStage, handleSubmit, draft, updateDraft, transitionTo, error, setError, loading, setScreenshotPreview, screenshotPreview, allowedUpiIds, total }: any) {
  // idle | uploading | reading | found | partial | wrong-payee | failed | upload-failed
  const [scan, setScan] = useState<{ state: string; progress: number; detail?: string }>({ state: 'idle', progress: 0 })

  // What the receipt said, kept apart from the draft so the reading can be
  // shown even when it was refused for naming the wrong payee.
  const [seen, setSeen] = useState<{ utr: string | null; upi: string | null }>({ utr: null, upi: null })
  // The draft as it is now. A receipt is read after an await, by which time
  // the `draft` this handler closed over can be out of date - the visitor may
  // have changed the payee while the scan ran.
  const latestDraft = useRef<DraftState>(draft)
  useEffect(() => { latestDraft.current = draft }, [draft])

  const receivers: string[] = (allowedUpiIds && allowedUpiIds.length > 0)
    ? allowedUpiIds
    : (event?.config?.upi_ids || (event?.config?.upi_id ? [event.config.upi_id] : []))

  /**
   * Starts the payee on whichever id was chosen on the payment screen.
   *
   * That is the id they were shown and paid, so asking for it again is asking
   * a question already answered - and the answer was one field away on the
   * previous step. It is still a dropdown they can change, for the person who
   * paid a different id from the one on screen.
   *
   * `|| receivers[0]` matters: the payment screen displays the first id as
   * selected but only writes selectedUpiId when the visitor *changes* it, so
   * anybody who paid the id they were shown left it empty. Reading the same
   * default the screen displayed is what makes accepting it count as a choice.
   *
   * Once only, guarded by the ref rather than by the field being empty:
   * uploading a receipt clears the payee before the scan fills it, and a
   * condition on emptiness would race the OCR to write the same value.
   */
  const prefilledPayee = useRef(false)
  useEffect(() => {
    // The list arrives from /api/upi-ids, so the first renders have none.
    if (prefilledPayee.current || receivers.length === 0) return
    prefilledPayee.current = true

    if (draft.receiverUpi) return
    const chosen = receivers.includes(draft.selectedUpiId) ? draft.selectedUpiId : receivers[0]
    if (chosen) updateDraft({ receiverUpi: chosen, receiverUpiFromOcr: false })
  }, [receivers, draft.selectedUpiId, draft.receiverUpi, updateDraft])

  async function handleReceipt(file: File) {
    // The payee is left as it is while the receipt is stored and read, and
    // only replaced once the scan has something to say (below). Clearing it
    // here dropped the dropdown to "Select the UPI ID you paid" for the whole
    // scan - and left it there for good if the upload then failed.
    updateDraft({ screenshot: file.name, receiptPath: '', utr: '', utrFromOcr: false, receiverUpiFromOcr: false })
    setScreenshotPreview(URL.createObjectURL(file))
    setSeen({ utr: null, upi: null })

    // Stored first. A receipt that cannot be kept is no use to whoever has to
    // verify the payment later, so the step does not go on without it.
    setScan({ state: 'uploading', progress: 0 })
    try {
      const body = new FormData()
      body.append('receipt', file)
      const res = await fetch('/api/receipts', { method: 'POST', body })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Could not store the receipt.')
      updateDraft({ receiptPath: payload.path })
    } catch (e: any) {
      setScan({ state: 'upload-failed', progress: 1, detail: e?.message })
      return
    }

    setScan({ state: 'reading', progress: 0 })
    const { readReceipt } = await import('@/utils/ocr/read-receipt')
    const result = await readReceipt(file, (progress) => setScan({ state: 'reading', progress }))

    const allowed = receivers.map((id: string) => normaliseUpi(id))
    const candidates = result.upiCandidates.map(normaliseUpi)

    // Exact reading, then a misread recovered character by character, then a
    // partly hidden handle matched against the ids we collect at. Anything
    // ambiguous comes back with no id at all.
    const { resolveReceiverUpi, settleReceiver } = await import('@/utils/ocr/receipt')
    const payee = resolveReceiverUpi(candidates, allowed)

    const utr = isValidUtr(result.transactionId) ? normaliseUtr(result.transactionId) : ''

    // The receipt's guess replaces the payee; with no guess, what the dropdown
    // holds now stands - read from the draft as it is after the scan, not as
    // it was before it, so a payee changed while the receipt was being read is
    // the one kept.
    // `|| selectedUpiId || receivers[0]` is the id the payment screen showed as
    // selected, which it only records once it is *changed*.
    const now = latestDraft.current
    const current = normaliseUpi(now.receiverUpi || now.selectedUpiId || receivers[0] || '')
    const settled = settleReceiver(current && allowed.includes(current) ? current : '', payee)
    const receiver = settled.id

    updateDraft({
      utr,
      utrFromOcr: Boolean(utr),
      receiverUpi: receiver,
      receiverUpiFromOcr: settled.fromReceipt,
    })

    // The only thing worth saying is what could not be read. A success needs no
    // announcement - the filled field is the announcement - and naming the one
    // field still blank is what tells somebody where to look.
    const unread: string[] = []
    if (!utr) unread.push('transaction ID')
    if (!receiver) unread.push('UPI ID')

    setScan({ state: 'idle', progress: 1 })
    if (unread.length > 0) {
      setError(`Unable to read ${unread.join(' and ')} field${unread.length > 1 ? 's' : ''}. Please fill manually.`)
    } else {
      setError(null)
    }
  }

    // The same verdicts the gate reaches, expressed on the fields themselves.
  const utrState = fieldState(draft.utr, {
    touched: Boolean(draft.screenshot),
    rule: (v) => (isValidUtr(v) ? null : 'That does not look like a transaction id.'),
  })
  const upiState = fieldState(draft.receiverUpi, {
    touched: Boolean(draft.screenshot),
    rule: (v) => (receivers.length > 0 && !receivers.map((x: string) => normaliseUpi(x)).includes(normaliseUpi(v))
      ? 'This is not a UPI ID the festival collects at.'
      : null),
  })

  const gate = checkReceiptDetails({
    isFree: total === 0,
    utr: draft.utr,
    receiverUpi: draft.receiverUpi,
    receiptPath: draft.receiptPath,
    allowedUpiIds: receivers,
  })

  return (
    <div className="reg-payment-done">
      <TypewriterHeading lines={['VERIFYING PAYMENT']} />
      <p className="reg-p reg-p--tight">Please provide your transaction details and check their correctness</p>

      {/* Two panels side by side, the way the payment step is built. The
          receipt feeds the fields beside it, so they belong on one screen:
          stacked full width they ran past the bottom of the card, and plain
          text sat straight on the decorative background and was hard to read.
          Opaque boxes fix both without touching the background. */}
      <div className="reg-verify-grid">
      <div className="reg-pay-box reg-verify-box">
        <label className="reg-verify-label">Payment Receipt *</label>
        <div className="reg-upload-area">
          <input type="file" id="receipt-upload" className="reg-file-input" accept="image/*" onChange={e => {
            if (e.target.files?.[0]) handleReceipt(e.target.files[0])
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
                  {/* Removing the receipt has to undo everything the receipt
                      produced. Clearing only `screenshot` left receiptPath,
                      utr and receiverUpi behind, and the gate reads those - so
                      the step stayed unlocked with no receipt attached to it. */}
                  <button
                    type="button"
                    className="reg-btn-remove"
                    onClick={() => {
                      updateDraft({
                        screenshot: null,
                        receiptPath: '',
                        utr: '',
                        receiverUpi: '',
                        utrFromOcr: false,
                        receiverUpiFromOcr: false,
                      })
                      setScreenshotPreview(null)
                      setSeen({ utr: null, upi: null })
                      setScan({ state: 'idle', progress: 0 })
                    }}
                  >Remove</button>
               </div>
            </div>
          )}
        </div>

        {/* Progress only. Whether a field was read is said by the field being
            filled or not; a running commentary on the reader is noise, and the
            one useful message - which field is still blank - goes to the same
            notice every other part of the form uses. */}
        {(scan.state === 'uploading' || scan.state === 'reading') && (
          <div className="reg-scan" aria-live="polite">
            {scan.state === 'uploading'
              ? <span>Saving your receipt…</span>
              : <span>Reading your receipt… {Math.round(scan.progress * 100)}%</span>}
          </div>
        )}
        {scan.state === 'upload-failed' && (
          <div className="reg-scan reg-scan--partial" aria-live="polite">
            {scan.detail || 'Could not save the receipt.'} Please try uploading it again -
            the registration cannot be submitted without it.
          </div>
        )}
      </div>

      <div className="reg-pay-box reg-verify-box reg-verify-box--fields">
      {/* Transaction ID and payee. Filled from the receipt when they can be
          read, and always editable: OCR misreads a digit often enough that
          locking the field just strands people on a value they can see is
          wrong. Nothing is lost by letting them fix it - the receipt image is
          stored alongside, and a verifier checks both against it. Removing the
          image clears these, so a fresh receipt starts from nothing. */}
      <div className="reg-field full" style={{ marginTop: '2cqw' }}>
        <label>UPI Transaction ID / UTR *</label>
        <input
          {...fieldProps(utrState)}
          className={`reg-input ${fieldProps(utrState).className}`}
          value={draft.utr}
          onChange={e => updateDraft({ utr: e.target.value, utrFromOcr: false })}
          placeholder="Enter your UPI Transaction ID"
          inputMode="text"
          autoComplete="off"
        />
        {draft.utrFromOcr && draft.utr && (
          <span className="reg-read__note">read from your receipt — correct it if it is wrong</span>
        )}
      </div>

      <div className="reg-field full" style={{ marginTop: '2cqw' }}>
        <label>Paid to (UPI ID) *</label>
        {/* Always a choice from the same list, in the same order the payment
            screen showed - `receivers` comes from the one endpoint, so the two
            cannot drift apart. Never a free text box: a typed handle is either
            one of these or a payment we did not receive, and letting somebody
            invent one only produces a registration nobody can verify. */}
        <select {...fieldProps(upiState)} className={`reg-input ${fieldProps(upiState).className}`} value={draft.receiverUpi || ''} onChange={e => updateDraft({ receiverUpi: e.target.value, receiverUpiFromOcr: false })}>
          <option value="" disabled>Select the UPI ID you paid</option>
          {receivers.map((id: string) => <option key={id} value={id}>{id}</option>)}
        </select>
        {receivers.length === 0 && (
          <span className="reg-read__note">
            No collection IDs are configured for this event. Please contact the organisers.
          </span>
        )}
        {draft.receiverUpiFromOcr && draft.receiverUpi && (
          <span className="reg-read__note">read from your receipt — correct it if it is wrong</span>
        )}
      </div>

      </div>
      </div>

      <div className="reg-actions dual">
        <RegButton text="BACK" onClick={() => transitionTo({ paymentState: 'READY' })} type="back" />
        {/* Deliberately not disabled. handleSubmit re-checks the same gate and
            puts the reason in the notice, so pressing it answers "why not?" -
            a dead button with nothing to click only poses the question. */}
        <RegButton text="SUBMIT" onClick={handleSubmit} loading={loading} loadingText="PROCESSING..." type="continue" />
      </div>
    </div>
  )
}

function ConfirmationStep({ confirmation }: any) {
  const [copied, setCopied] = useState(false)
  const tokenDisplay = confirmation?.token?.includes('_') ? confirmation.token.split('_')[0] : (confirmation?.token || 'MBH-ID')
  const handleCopy = () => {
    navigator.clipboard.writeText(tokenDisplay)
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
             <strong className="id-val">{tokenDisplay}</strong>
             <button className="reg-btn-copy-small" onClick={handleCopy}>{copied ? '✓' : 'COPY'}</button>
          </div>
       </div>

       <RegButton text="GO TO HOME" onClick={() => window.location.href = '/'} type="home" />
    </div>
  )
}
