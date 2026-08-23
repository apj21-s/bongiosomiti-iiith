import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { registerSchema } from '@/utils/schemas'
import { sendQRPassEmail, sendRegistrationPendingEmail } from '@/utils/email'

function generateToken(prefix: string) {
  const p = (prefix || 'UTSAV').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const time = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${p}-${time}-${rand}`
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

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('slug', data.eventSlug)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (event.status !== 'OPEN') {
      return NextResponse.json({ error: 'Event is closed for registration' }, { status: 400 })
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
    const token = generateToken(prefix)

    const isFree = event.price === 0
    const numPasses = data.numPasses || 1
    const isIiit = data.isIiit !== false
    const passPrice = isFree ? 0 : isIiit ? event.price : 350
    const subtotal = numPasses * passPrice
    const discountAmount = data.couponCode ? (data.discountAmount || 50) : 0
    const amount = Math.max(0, subtotal - discountAmount)
    const paymentStatus = isFree ? 'APPROVED' : 'PENDING'
    const status = isFree ? 'UNUSED' : 'PENDING_PAYMENT'

    const ticketsData = Array.from({ length: numPasses }).map((_, i) => ({
      token: generateToken(prefix),
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
      food_pref: data.foodPref,
      is_iiit: isIiit,
      coupon_code: data.couponCode || null,
      discount_amount: discountAmount / numPasses,
    }))

    const { data: tickets, error: ticketError } = await supabase
      .from('tickets')
      .insert(ticketsData)
      .select()

    if (ticketError || !tickets) {
      return NextResponse.json({ error: ticketError?.message || 'Failed to generate tickets' }, { status: 500 })
    }

    const tokens = tickets.map(t => t.token)

    if (paymentStatus === 'APPROVED') {
      await sendQRPassEmail(data.email, data.participantName, event.name, tokens).catch(e => console.error('Failed to send email:', e))
    } else if (paymentStatus === 'PENDING') {
      await sendRegistrationPendingEmail(data.email, data.participantName, event.name, data.utr || '').catch(e => console.error('Failed to send pending email:', e))
    }

    return NextResponse.json(tickets[0])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
