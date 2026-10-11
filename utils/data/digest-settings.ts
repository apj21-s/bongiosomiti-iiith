import { createServiceRoleClient } from '@/utils/supabase/server'

/**
 * Whether the daily manager digest is paused, from the digest_settings row.
 *
 * Paused stops the cron only. A super admin pressing Send on /admin/digests
 * has asked for that email, so the manual sends go out either way.
 */
export type DigestSettings = {
  isPaused: boolean
  /** False when supabase/digest-settings.sql has not been run yet. */
  available: boolean
  updatedAt?: string | null
  updatedBy?: string | null
}

export async function getDigestSettings(): Promise<DigestSettings> {
  try {
    const supabase = await createServiceRoleClient()
    const { data, error } = await supabase
      .from('digest_settings')
      .select('is_paused, updated_at, updated_by')
      .maybeSingle()

    // A missing table is not a reason to stop the digest: it ran before this
    // setting existed, and it keeps running until somebody pauses it.
    if (error) return { isPaused: false, available: false }
    if (!data) return { isPaused: false, available: true }

    return {
      isPaused: data.is_paused === true,
      available: true,
      updatedAt: data.updated_at ?? null,
      updatedBy: data.updated_by ?? null,
    }
  } catch {
    return { isPaused: false, available: false }
  }
}

export async function setDigestPaused(
  isPaused: boolean,
  actor: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServiceRoleClient()
  const { error } = await supabase
    .from('digest_settings')
    .upsert({ id: true, is_paused: isPaused, updated_at: new Date().toISOString(), updated_by: actor })

  if (error) {
    return {
      ok: false,
      error: /digest_settings|PGRST205/.test(error.message) ? 'Run supabase/digest-settings.sql first.' : error.message,
    }
  }
  return { ok: true }
}
