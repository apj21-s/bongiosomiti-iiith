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
    sidebar: ['overview', 'registrations', 'payments', 'check-ins', 'events', 'scanner'],
    overview: ['registrations', 'checkins', 'stats'],
    canAccessRegistrations: true,
    canAccessPayments: true,
    canAccessCheckins: true,
    canAccessEvents: true,
    canUseCheckinActions: true,
  },
} as const

export function getAdminCredentials(): { email: string; password: string; tier: AdminTier }[] {
  return [
    {
      email: process.env.TIER1_EMAIL || 'gate@gmail.com',
      password: process.env.TIER1_PASSWORD || 'Gate@123',
      tier: 1,
    },
    {
      email: process.env.TIER2_EMAIL || 'manager@gmail.com',
      password: process.env.TIER2_PASSWORD || 'Manager@123',
      tier: 2,
    },
    {
      email: process.env.TIER3_EMAIL || 'admin@gmail.com',
      password: process.env.TIER3_PASSWORD || 'Admin@123',
      tier: 3,
    },
  ]
}

export function matchAdminCredentials(email: string, password: string): AdminTier | null {
  const admins = getAdminCredentials()
  const match = admins.find(a => a.email === email && a.password === password)
  return match ? match.tier : null
}

export function getTierForEmail(email: string): AdminTier | null {
  const admins = getAdminCredentials()
  const match = admins.find(a => a.email === email)
  return match ? match.tier : null
}
