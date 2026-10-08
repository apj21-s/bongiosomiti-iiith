import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { countForDigest, worthSending, digestSubject } from '@/utils/digest'
import { sendManagerDigestEmail } from '@/utils/email'

export const maxDuration = 300 // Allowed for Pro/Enterprise, doesn't hurt on Hobby

export async function GET(request: Request) {
  // Secure the cron route by checking the authorization header
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const supabase = await createServiceRoleClient()

    // Fetch active managers
    const { data: managers, error } = await supabase
      .from('manager_profiles')
      .select('id,username,name,email,upi_id,is_active,digest_sent_at')
      .eq('is_active', true)

    if (error) throw error

    if (!managers || managers.length === 0) {
      return NextResponse.json({ message: 'No active managers. Nothing to do.' })
    }

    let sent = 0, skipped = 0, failed = 0

    for (const m of managers) {
      const upi = (m.upi_id || '').toLowerCase()

      const filter = `assigned_manager_id.eq.${m.id},and(assigned_manager_id.is.null,allocation_flagged_at.is.null,receiver_upi.ilike.${upi})`

      const { data: tickets } = await supabase
        .from('tickets')
        .select('payment_status,assigned_manager_id,assigned_at')
        .or(filter)

      const since = m.digest_sent_at ? new Date(m.digest_sent_at) : null
      const counts = countForDigest(tickets || [], m.id, since)
      const who = m.name || m.username

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

    return NextResponse.json({ message: `Sent: ${sent}, Skipped: ${skipped}, Failed: ${failed}` })
  } catch (error: any) {
    console.error('Cron Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
