import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { registerSchema } from '@/utils/schemas'
import { sendQRPassEmail, sendRegistrationPendingEmail } from '@/utils/email'
import { getEventBySlug } from '@/utils/data/events'
import { rateLimit, tooManyRequests } from '@/utils/rate-limit'

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

// The discount is whatever the event's own coupon list says it is. Trusting the
// amount from the request body let a caller name their own price.
function resolveCoupon(event: any, submittedCode: string | undefined) {
  if (!submittedCode) return null

  const code = submittedCode.trim().toUpperCase()
  if (!code) return null

  const coupons = Array.isArray(event?.config?.coupons) ? event.config.coupons : []
  const match = coupons.find((c: any) => String(c?.code || '').trim().toUpperCase() === code)
  if (!match) return null

  const discount = Number(match.discount)
  if (!Number.isFinite(discount) || discount <= 0) return null

  return { code: String(match.code), discount: Math.floor(discount) }
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

    const event = getEventBySlug(data.eventSlug)
    
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
    const isIiit = data.isIiit !== false
    const passPrice = isFree ? 0 : isIiit ? event.price : 350
    const subtotal = numPasses * passPrice
    const coupon = resolveCoupon(event, data.couponCode)
    const discountAmount = coupon ? Math.min(coupon.discount, subtotal) : 0
    const amount = Math.max(0, subtotal - discountAmount)
    // Normalised so a manager scoped to this UPI id matches it regardless of
    // how the receipt or the visitor cased it.
    const receiverUpi = data.receiverUpi?.trim().toLowerCase() || null
    const paymentStatus = isFree ? 'APPROVED' : 'PENDING'
    const status = isFree ? 'UNUSED' : 'PENDING_PAYMENT'

    const ticketsData = Array.from({ length: numPasses }).map((_, i) => ({
      token: `${registrationId}_${generatePassCode(prefix)}`,
      event_id: event.id,
      participant_name: data.participantName + (numPasses > 1 && i > 0 ? ` (Pass ${i + 1})` : ''),
      college_id: data.collegeId,
      email: data.email,
      phone: data.phone,
      utr: data.utr || (isFree ? 'FREE-PASS' : ''),
      amount: amount / numPasses,
      payment_status: paymentStatus,
      status,
      num_passes: 1,
      food_pref: (data as any).vegCount !== undefined && (data as any).nonVegCount !== undefined 
        ? (i < (data as any).vegCount ? 'Veg' : 'Non-Veg')
        : data.foodPref,
      receiver_upi: receiverUpi,
      is_iiit: isIiit,
      coupon_code: coupon ? coupon.code : null,
      discount_amount: discountAmount / numPasses,
    }))

    const { data: tickets, error: ticketError } = await supabase
      .from('tickets')
      .insert(ticketsData)
      .select()

    if (ticketError || !tickets) {
      return NextResponse.json({ error: ticketError?.message || 'Failed to generate tickets' }, { status: 500 })
    }

    const tokens = tickets.map((t: any) => t.token)

    if (paymentStatus === 'APPROVED') {
      await sendQRPassEmail(data.email as string, data.participantName as string, event.name as string, tokens).catch(e => console.error('Failed to send email:', e))
    } else if (paymentStatus === 'PENDING') {
      await sendRegistrationPendingEmail(data.email as string, data.participantName as string, event.name as string, data.utr || '', registrationId).catch(e => console.error('Failed to send pending email:', e))
    }

    return NextResponse.json(tickets[0])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
