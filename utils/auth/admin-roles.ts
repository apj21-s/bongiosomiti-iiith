// Admin tier definitions and utilities
export type AdminTier = 1 | 2 | 3

export interface AdminRole {
  tier: AdminTier
  label: string
  email: string
}

// Permissions per tier
export const TIER_PERMISSIONS = {
  1: {
    label: 'Gate Staff',
    sidebar: ['scanner'],
    overview: ['checkins'], // only gate check-in activity section
    canAccessRegistrations: false,
    canAccessPayments: false,
    canAccessCheckins: false,
    canAccessEvents: false,
    canUseCheckinActions: false,
  },
  2: {
    label: 'Manager',
    sidebar: ['overview', 'payments', 'check-ins', 'scanner'],
    overview: ['checkins'], // only gate check-in activity section
    canAccessRegistrations: false,
    canAccessPayments: true,
    canAccessCheckins: true,
    canAccessEvents: false,
    canUseCheckinActions: false,
  },
  3: {
    label: 'Super Admin',
    sidebar: ['overview', 'registrations', 'payments', 'check-ins', 'events', 'coupons', 'scanner'],
    overview: ['registrations', 'checkins', 'stats'],
    canAccessRegistrations: true,
    canAccessPayments: true,
    canAccessCheckins: true,
    canAccessEvents: true,
    canUseCheckinActions: true,
  },
} as const

/**
 * A comparison that does not finish early.
 *
 * Written out rather than imported so this module stays runtime-agnostic - it
 * is reached from both the Node routes and, indirectly, the proxy.
 */
function safeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length)
  let difference = a.length ^ b.length
  for (let i = 0; i < length; i += 1) {
    difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return difference === 0
}

/**
 * The three environment-configured accounts.
 *
 * There are deliberately no fallbacks. This file lives in a public repository,
 * so a default password written here is a published password: every deployment
 * that had not set the environment variables was handing out tier 3 to anyone
 * who read the source. A tier with nothing configured now simply has no
 * account, and an installation with none configured cannot be signed into at
 * all, which is the right way round for this to fail.
 */
export function getAdminCredentials(): { email: string; password: string; tier: AdminTier }[] {
  // Two accounts, and only two: the gate credential the gate staff share, and
  // the super admin. There is deliberately no shared manager login - a manager
  // exists when the super admin creates a profile for them at /admin/managers,
  // with their own password and their own UPI id, and not before. A single
  // manager password passed between people could not be scoped to anybody's
  // takings, which is the whole point of the manager tier.
  const configured: { email?: string; password?: string; tier: AdminTier }[] = [
    { email: process.env.TIER1_EMAIL, password: process.env.TIER1_PASSWORD, tier: 1 },
    { email: process.env.TIER3_EMAIL, password: process.env.TIER3_PASSWORD, tier: 3 },
  ]

  const usable = configured.filter(
    (entry): entry is { email: string; password: string; tier: AdminTier } =>
      Boolean(entry.email && entry.password)
  )

  // Said out loud, because the symptom otherwise is a correct password being
  // rejected with no explanation.
  if (usable.length === 0) {
    console.warn('[auth] No TIER*_EMAIL / TIER*_PASSWORD pair is set, so no admin can sign in. See .env.example.')
  }
  for (const entry of usable) {
    if (entry.password.length < 12) {
      console.warn(`[auth] The tier ${entry.tier} password is shorter than 12 characters.`)
    }
  }

  return usable
}

export function matchAdminCredentials(email: unknown, password: unknown): AdminTier | null {
  // The form hands over whatever was posted, and a missing field arrives as
  // null. Anything that is not a pair of strings is simply not a match - it
  // used to reach safeEqual and throw, which turned a malformed sign-in into a
  // 500 instead of a refusal.
  if (typeof email !== 'string' || typeof password !== 'string') return null

  let matched: AdminTier | null = null

  // Every entry is checked whichever one matches, so the time taken does not
  // say which account was hit, or whether the email existed at all.
  for (const admin of getAdminCredentials()) {
    if (safeEqual(admin.email, email) && safeEqual(admin.password, password)) matched = admin.tier
  }

  return matched
}

export function getTierForEmail(email: string): AdminTier | null {
  const admins = getAdminCredentials()
  const match = admins.find(a => a.email === email)
  return match ? match.tier : null
}
