import { requireAdmin } from '@/utils/auth/require-admin'
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { listManagers } from '@/utils/auth/managers'

/**
 * The payments no manager will claim, and the managers they could go to.
 *
 * Reported by a collector as not theirs, and not yet routed. They belong to
 * nobody until a super admin decides, which is the point: a payment in dispute
 * should be visibly waiting on someone rather than sitting unverifiable in a
 * queue where it will be ignored.
 *
 * The manager list comes back with it so the reassignment UI has something to
 * choose from without a second round trip. Password hashes are never selected.
 */
export async function GET() {
  const guard = await requireAdmin(3)
  if (!guard.ok) return guard.response

  const supabase = await createServiceRoleClient()

  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      event:events ( slug, name )
    `)
    .not('allocation_flagged_at', 'is', null)
    .is('assigned_manager_id', null)
    .order('allocation_flagged_at', { ascending: false })

  if (error) {
    if (/allocation_flagged_at|assigned_manager_id/.test(error.message || '')) {
      return NextResponse.json(
        { error: 'Run supabase/wrong-allocations.sql first.', payments: [], managers: [] },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message, payments: [], managers: [] }, { status: 500 })
  }

  const managers = (await listManagers()).filter((m) => m.isActive)

  // One row per booking rather than per pass: they were flagged together and
  // will be routed together, so showing five of the same thing is just noise.
  const seen = new Set<string>()
  const payments = (data || []).filter((row: { utr?: string; token: string }) => {
    const key = row.utr && row.utr !== 'FREE-PASS' ? row.utr : row.token
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return NextResponse.json({ payments, managers })
}
