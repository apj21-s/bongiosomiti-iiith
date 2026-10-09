import { NextResponse } from 'next/server'
import { requireAdmin } from '@/utils/auth/require-admin'
import { createManager, listManagers, normaliseUpiId } from '@/utils/auth/managers'
import { createServiceRoleClient } from '@/utils/supabase/server'

// Creating and listing manager profiles is a super-admin job.
const REQUIRED_TIER = 3

export async function GET() {
  const guard = await requireAdmin(REQUIRED_TIER)
  if (!guard.ok) return guard.response

  const managers = await listManagers()

  const supabase = await createServiceRoleClient()
  const { data: tickets } = await supabase
    .from('tickets')
    .select('receiver_upi, amount')
    .eq('payment_status', 'APPROVED')

  const amountByUpi = new Map<string, number>()
  if (tickets) {
    for (const ticket of tickets) {
      if (!ticket.receiver_upi) continue
      const upi = normaliseUpiId(String(ticket.receiver_upi))
      amountByUpi.set(upi, (amountByUpi.get(upi) || 0) + (Number(ticket.amount) || 0))
    }
  }

  const enrichedManagers = managers.map(m => ({
    ...m,
    totalVerifiedAmount: amountByUpi.get(normaliseUpiId(m.upiId)) || 0
  }))

  return NextResponse.json(enrichedManagers)
}

export async function POST(request: Request) {
  const guard = await requireAdmin(REQUIRED_TIER)
  if (!guard.ok) return guard.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const input = (body ?? {}) as Record<string, unknown>
  const username = typeof input.username === 'string' ? input.username : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const upiId = typeof input.upiId === 'string' ? input.upiId : ''
  const email = typeof input.email === 'string' ? input.email : ''
  const name = typeof input.name === 'string' ? input.name : undefined

  const result = await createManager({
    username,
    password,
    upiId,
    email,
    name,
    createdBy: String(guard.user.email || guard.user.id),
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json(result.manager, { status: 201 })
}
