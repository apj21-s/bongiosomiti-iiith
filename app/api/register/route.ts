import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { registerSchema } from '@/utils/schemas'
import { sendQRPassEmail, sendRegistrationPendingEmail } from '@/utils/email'
import { getEventBySlug } from '@/utils/data/events'
import { rateLimit, tooManyRequests } from '@/utils/rate-limit'
import { checkReceiptDetails, normaliseUpi, normaliseUtr } from '@/utils/payments/receipt-gate'
import { listCollectionUpiIds } from '@/utils/auth/managers'
import {
  iiitClaimAllowed,
  isPlausibleEmail,
  normaliseEmail,
  verifyProof,
} from '@/utils/email-verification'
import { audienceFor, expandToPasses, inPassOrder, quote, splitWholeRupees } from '@/utils/pricing'
import { resolveCoupon } from '@/utils/coupons'
import { countRegistrations } from '@/utils/data/registrations'

// Registration sends mail to the address in the request, so it is throttled per
// address. Deliberately not per IP: an entire campus shares a handful of them.
const REGISTER_LIMIT = 5
const REGISTER_WINDOW_MS = 10 * 60 * 1000

function generateRegistrationId() {
  return Math.floor(10000 + Math.random() * 90000).toString() // 5 digits
}

function generatePassCode(prefix: string) {
  const p = (prefix || 'UTS').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3)
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase() // 6 chars
  return `${p}${rand}`.slice(0, 9).padEnd(9, 'X') // 9 chars total
}

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const result = registerSchema.safeParse(json)

    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input', details: result.error }, { status: 400 })
    }

    const data = result.data
    const supabase = await createServiceRoleClient()

    const event = await getEventBySlug(data.eventSlug)
    
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (event.status !== 'OPEN') {
      return NextResponse.json({ error: 'Event is closed for registration' }, { status: 400 })
    }

    if (data.email) {
      const limit = rateLimit(`register:${data.email.toLowerCase()}`, REGISTER_LIMIT, REGISTER_WINDOW_MS)
      if (!limit.allowed) {
        return tooManyRequests(
          limit.retryAfterSeconds,
          'Too many registration attempts for this email address. Please wait a few minutes and try again.'
        )
      }
    }

    // The address has to be one the registrant can actually read. /api/verify-email
    // mails a code and hands back a signed proof when it comes back; this is where
    // that proof is spent. The form checks the same thing, but the form is a
    // courtesy - a request that skips it simply arrives without a proof.
    const verifiedEmail = normaliseEmail(data.email)
    if (!isPlausibleEmail(verifiedEmail)) {
      return NextResponse.json(
        { error: 'A valid email address is required.', field: 'email' },
        { status: 400 }
      )
    }

    const proofSecret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!proofSecret) {
      console.error('[register] No SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY; cannot check email proofs.')
      return NextResponse.json({ error: 'Registration is not configured on this server.' }, { status: 503 })
    }

    if (!(await verifyProof(data.emailProof, verifiedEmail, proofSecret))) {
      return NextResponse.json(
        { error: 'Please confirm your email address before registering.', field: 'email' },
        { status: 400 }
      )
    }

    const { count, error: countError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .in('payment_status', ['PENDING', 'APPROVED'])

    if (countError) {
      return NextResponse.json({ error: 'Failed to verify capacity' }, { status: 500 })
    }

    if ((count || 0) >= event.capacity) {
      return NextResponse.json({ error: 'Event capacity reached' }, { status: 400 })
    }

    const prefix = event.slug.slice(0, 3).toUpperCase()
    const registrationId = generateRegistrationId()

    const isFree = event.price === 0


    const numPasses = data.numPasses || 1

    // The institute price is granted on the strength of the address that was
    // actually verified, not on a boolean in the request body. That boolean set
    // the price on its own until now, so a stranger who ticked "yes" and typed
    // any roll number paid the student rate. The roll number proved nothing and
    // is no longer asked for - staff, faculty and alumni have never had one -
    // while the mailbox at iiit.ac.in is something only the institute can hand out.
    const claimsIiit = data.isIiit !== false
    if (!iiitClaimAllowed(claimsIiit, verifiedEmail)) {
      return NextResponse.json(
        {
          error: 'The institute rate needs a confirmed @iiit.ac.in address — students, research, staff, faculty, alumni, or ihub-data. Register as a guest, or use your institute email.',
          field: 'email',
        },
        { status: 400 }
      )
    }
    /*
      Priced here, from the verified address and the event's own table.

      What this replaced charged `numPasses x one flat rate` even when the
      event had pass types with prices of their own, so a basket the form
      showed as 700 was recorded as 500. The counts now arrive structured and
      go through the same function the form displays from, which is the only
      way the two can agree.

      The audience comes from the address that was actually confirmed, never
      from a field in the body - the same reasoning as the claim check above,
      one step further: it decides not just whether an institute rate applies
      but which one.

      This supersedes the same fix arrived at independently on origin/dev,
      which summed pass types inline. The difference that matters is the key:
      that version looked selections up by pt.name, and two plates named "Veg"
      under different meals are one key - so a breakfast and a lunch shared a
      counter. quote() keys on meal+name. It also carries the per-audience
      prices, which an inline sum of pt.price cannot.
    */
    const audience = audienceFor(verifiedEmail, claimsIiit)
    const priced = quote(
      event,
      { selections: data.passSelections, numPasses },
      audience
    )
    const subtotal = priced.subtotal
    /*
      The coupon is resolved here and nowhere else that matters.

      A code can be conditional - on the basket being above a threshold, or on
      this being one of the first N registrations - so it needs the subtotal
      this route just worked out and a count of what already exists. Both are
      read on the server. The form asks the same question of
      /api/events/<slug>/coupon so it can show the discount before submitting,
      but that answer is only a preview: whatever it said, the booking is
      priced by this call.
    */
    const registrationsSoFar = await countRegistrations(event.id)
    const couponVerdict = resolveCoupon(event, data.couponCode, { subtotal, registrationsSoFar })
    const coupon = couponVerdict.ok ? couponVerdict : null
    const discountAmount = coupon ? Math.min(coupon.discount, subtotal) : 0
    const amount = Math.max(0, subtotal - discountAmount)

    // The same gate the form applies, applied again here. The form's copy is a
    // courtesy to the visitor; this one is the rule. A payable registration
    // without a transaction id, without a stored receipt, or naming a UPI id
    // this festival does not collect at, does not become a ticket. Gated on
    // the amount rather than the ticket price, because a coupon can take a
    // paid event to zero and then there is no receipt to ask for.
    const managerUpiIds = await listCollectionUpiIds()
    const eventConfig = (event as { config?: { upi_ids?: unknown; upi_id?: unknown } }).config
    const configuredUpiIds: string[] = Array.isArray(eventConfig?.upi_ids)
      ? (eventConfig.upi_ids as string[])
      : (typeof eventConfig?.upi_id === 'string' ? [eventConfig.upi_id] : [])
    const allowedUpiIds = (managerUpiIds.length > 0 ? managerUpiIds : configuredUpiIds).map(normaliseUpi)
    const nothingToPay = isFree || amount === 0

    const gate = checkReceiptDetails({
      isFree: nothingToPay,
      utr: data.utr,
      receiverUpi: data.receiverUpi,
      receiptPath: data.receiptPath,
      allowedUpiIds,
    })

    if (!gate.ok) {
      return NextResponse.json({ error: gate.error, field: gate.field }, { status: 400 })
    }
    // Normalised so a manager scoped to this UPI id matches it regardless of
    // how the receipt or the visitor cased it.
    const receiverUpi = normaliseUpi(data.receiverUpi) || null
    const paymentStatus = isFree ? 'APPROVED' : 'PENDING'
    const status = isFree ? 'UNUSED' : 'PENDING_PAYMENT'

    /*
      One ticket per plate, each carrying its own plate and its own price.

      A pass admits its holder to one thing, so it has to say which: every
      ticket in a booking used to be stamped with the joined summary of the
      whole order - "1 Breakfast Veg, 2 Lunch Non-Veg" on all three - which
      tells whoever is serving nothing about the pass in front of them. With
      sections configured the label reads "Breakfast · Veg".

      The amount is the plate's own too. Dividing the total evenly is only
      right while every plate costs the same, and it stopped being right the
      moment breakfast and lunch could be priced apart.

      Rounding and the pass count both come from the version of this written
      on origin/dev: money in whole rupees, and a count taken from what was
      actually priced rather than from numPasses in the body, which could
      disagree with the basket and issue the wrong number of tickets.
    */
    const issued = expandToPasses(event, { selections: data.passSelections, numPasses }, audience)
    const passCount = issued.length > 0 ? issued.length : numPasses

    // Coupons apply to the booking, not to a plate, so the discount is shared
    // out in proportion to what each plate cost - in whole rupees that add up
    // to exactly the discount, so the passes add up to exactly what was paid.
    // Rounding each pass on its own recorded a ₹1,000 booking as ₹999.
    const perPass = issued.length > 0
      ? issued.map((pass) => pass.price)
      : Array.from({ length: passCount }, () => 1)
    const discounts = splitWholeRupees(discountAmount, perPass)
    const amounts = issued.length > 0
      ? issued.map((pass, i) => pass.price - discounts[i])
      : splitWholeRupees(amount, perPass)

    const ticketsData = Array.from({ length: passCount }).map((_, i) => ({
      token: `${registrationId}_${generatePassCode(prefix)}`,
      event_id: event.id,
      participant_name: data.participantName + (passCount > 1 && i > 0 ? ` (Pass ${i + 1})` : ''),
      college_id: data.collegeId,
      email: data.email,
      phone: data.phone,
      utr: normaliseUtr(data.utr) || (nothingToPay ? 'FREE-PASS' : ''),
      amount: amounts[i],
      payment_status: paymentStatus,
      status,
      num_passes: 1,
      food_pref: issued[i]
        ? issued[i].label
        : data.vegCount !== undefined && data.nonVegCount !== undefined
          ? (i < data.vegCount ? 'Veg' : 'Non-Veg')
          : data.foodPref,
      receiver_upi: receiverUpi,
      // Every pass in one booking points at the same receipt.
      payment_proof_url: nothingToPay ? null : ((data.receiptPath as string) || null),
      // Of the institute at all, students and staff alike. Which of the two
      // decided the price is `audience`; this column only records whether the
      // guest rate applied.
      is_iiit: audience !== 'guest',
      coupon_code: coupon ? coupon.code : null,
      // Shared out the same way the amount above is, so the two agree per pass.
      discount_amount: discounts[i],
    }))

    const { data: tickets, error: ticketError } = await supabase
      .from('tickets')
      .insert(ticketsData)
      .select()

    if (ticketError || !tickets) {
      return NextResponse.json({ error: ticketError?.message || 'Failed to generate tickets' }, { status: 500 })
    }

    // Grouped by plate and stable, so a resend numbers the plates the way this
    // mail did.
    const ordered = inPassOrder(event, tickets)
    const tokens = ordered.map((t: any) => t.token)

    if (paymentStatus === 'APPROVED') {
      await sendQRPassEmail(
        data.email as string,
        data.participantName as string,
        event.name as string,
        tokens,
        // Same order as the tokens, and index by index with them: dropping
        // the empty ones would shift every later caption onto the wrong QR.
        ordered.map((t: any) => t.food_pref || ''),
      ).catch(e => console.error('Failed to send email:', e))
    } else if (paymentStatus === 'PENDING') {
      await sendRegistrationPendingEmail(data.email as string, data.participantName as string, event.name as string, data.utr || '', registrationId).catch(e => console.error('Failed to send pending email:', e))
    }

    return NextResponse.json(tickets[0])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
