import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { getAdminIdentity } from '@/utils/auth/server'
import { countForDigest, worthSending, digestSubject } from '@/utils/digest'
import { sendManagerDigestEmail } from '@/utils/email'

export async function POST(request: Request) {
  try {
    const { tier } = await getAdminIdentity()
    if (tier < 3) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { managerId } = await request.json().catch(() => ({}))

    const supabase = await createServiceRoleClient()

    let query = supabase
      .from('manager_profiles')
      .select('id,username,name,email,upi_id,is_active,digest_sent_at')
      .eq('is_active', true)

    if (managerId) {
      query = query.eq('id', managerId)
    }

    const { data: managers, error } = await query

    if (error) throw error

    if (!managers || managers.length === 0) {
      return NextResponse.json({ message: 'No active managers found.' })
    }

    let sent = 0, skipped = 0, failed = 0

    for (const m of managers) {
      const upi = (m.upi_id || '').toLowerCase()

      const filter = `assigned_manager_id.eq.${m.id},and(assigned_manager_id.is.null,allocation_flagged_at.is.null,receiver_upi.ilike.${upi})`

      const { data: tickets } = await supabase
        .from('tickets')
        .select('payment_status,assigned_manager_id,assigned_at')
        .or(filter)

      // When sending manually for a single manager, we might want to ignore the 'since' 
      // timestamp so it always sends a full snapshot if requested by the super admin.
      // But let's stick to the standard logic so we don't spam if they click "Send All"
      const since = m.digest_sent_at ? new Date(m.digest_sent_at) : null
      const counts = countForDigest(tickets || [], m.id, since)
      const who = m.name || m.username

      // For a specific manager targeted manually, send even if empty?
      // No, it's better to stick to standard logic: skip if nothing.
      if (!worthSending(counts)) {
        skipped += 1
        continue
      }
      if (!m.email) {
        skipped += 1
        continue
      }

      const subject = digestSubject(counts)
      const result = await sendManagerDigestEmail(m.email, who, m.upi_id, counts, subject)

      if (result.ok) {
        await supabase
          .from('manager_profiles')
          .update({ digest_sent_at: new Date().toISOString() })
          .eq('id', m.id)
        sent += 1
      } else {
        failed += 1
      }
    }

    return NextResponse.json({ sent, skipped, failed })
  } catch (error: any) {
    console.error('Manual Digest Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
