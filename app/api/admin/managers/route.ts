import { NextResponse } from 'next/server'
import { requireAdmin } from '@/utils/auth/require-admin'
import { createManager, listManagers } from '@/utils/auth/managers'

// Creating and listing manager profiles is a super-admin job.
const REQUIRED_TIER = 3

export async function GET() {
  const guard = await requireAdmin(REQUIRED_TIER)
  if (!guard.ok) return guard.response

  // Password hashes are never selected, so they cannot leak through this route.
  return NextResponse.json(await listManagers())
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
  const name = typeof input.name === 'string' ? input.name : undefined

  const result = await createManager({
    username,
    password,
    upiId,
    name,
    createdBy: String(guard.user.email || guard.user.id),
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json(result.manager, { status: 201 })
}
