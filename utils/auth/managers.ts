import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { createServiceRoleClient } from '@/utils/supabase/server'

/**
 * Manager profiles: accounts a super admin creates, each tied to the UPI id
 * that payments for them are made to.
 *
 * Passwords are hashed with scrypt from Node's own crypto, so there is no new
 * dependency and nothing reversible is stored. This module is Node-only (it is
 * imported by API routes, never by middleware or a client component).
 */

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>

const KEYLEN = 64
const SALT_BYTES = 16

export type ManagerProfile = {
  id: string
  username: string
  upiId: string
  name?: string | null
  isActive: boolean
  createdAt?: string | null
  createdBy?: string | null
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const derived = await scryptAsync(password, salt, KEYLEN)
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false

  try {
    const salt = Buffer.from(parts[1], 'hex')
    const expected = Buffer.from(parts[2], 'hex')
    if (expected.length !== KEYLEN) return false

    const derived = await scryptAsync(password, salt, KEYLEN)
    // Constant time: a length check first, since timingSafeEqual throws when
    // the buffers differ in size.
    return derived.length === expected.length && timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}

/** Normalised for comparison; UPI ids are case-insensitive in practice. */
export function normaliseUpiId(value: string): string {
  return value.trim().toLowerCase()
}

export function isValidUpiId(value: string): boolean {
  // handle@provider - the handle allows letters, digits, dot, dash, underscore.
  return /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.]{1,32}$/.test(value.trim())
}

type ManagerRow = {
  id: string
  username: string
  password_hash: string
  upi_id: string
  name: string | null
  is_active: boolean
  created_at: string | null
  created_by: string | null
}

function toProfile(row: ManagerRow): ManagerProfile {
  return {
    id: row.id,
    username: row.username,
    upiId: row.upi_id,
    name: row.name,
    isActive: row.is_active,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }
}

export async function listManagers(): Promise<ManagerProfile[]> {
  const supabase = await createServiceRoleClient()
  const { data, error } = await supabase
    .from('manager_profiles')
    .select('id, username, upi_id, name, is_active, created_at, created_by')
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return (data as ManagerRow[]).map(toProfile)
}

export async function getManagerById(id: string): Promise<ManagerProfile | null> {
  const supabase = await createServiceRoleClient()
  const { data, error } = await supabase
    .from('manager_profiles')
    .select('id, username, upi_id, name, is_active, created_at, created_by')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null
  const profile = toProfile(data as ManagerRow)
  return profile.isActive ? profile : null
}

export async function createManager(input: {
  username: string
  password: string
  upiId: string
  name?: string
  createdBy?: string
}): Promise<{ ok: true; manager: ManagerProfile } | { ok: false; error: string }> {
  const username = input.username.trim()
  const upiId = input.upiId.trim()

  if (username.length < 3 || username.length > 64) {
    return { ok: false, error: 'Username must be between 3 and 64 characters' }
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    return { ok: false, error: 'Username may only contain letters, digits, dot, dash and underscore' }
  }
  if (input.password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters' }
  }
  if (!isValidUpiId(upiId)) {
    return { ok: false, error: 'Enter a valid UPI ID, for example name@bank' }
  }

  const supabase = await createServiceRoleClient()
  const { data, error } = await supabase
    .from('manager_profiles')
    .insert({
      username,
      password_hash: await hashPassword(input.password),
      upi_id: upiId,
      name: input.name?.trim() || null,
      created_by: input.createdBy || null,
    })
    .select('id, username, upi_id, name, is_active, created_at, created_by')
    .single()

  if (error || !data) {
    const duplicate = (error?.code === '23505') || /duplicate|unique/i.test(error?.message || '')
    return { ok: false, error: duplicate ? 'That username is already taken' : (error?.message || 'Could not create the profile') }
  }

  return { ok: true, manager: toProfile(data as ManagerRow) }
}

export async function setManagerActive(id: string, isActive: boolean): Promise<boolean> {
  const supabase = await createServiceRoleClient()
  const { error } = await supabase.from('manager_profiles').update({ is_active: isActive }).eq('id', id)
  return !error
}

export async function deleteManager(id: string): Promise<boolean> {
  const supabase = await createServiceRoleClient()
  const { error } = await supabase.from('manager_profiles').delete().eq('id', id)
  return !error
}

/**
 * Looks a manager up by username and checks the password. Returns null for a
 * bad username, a bad password or a deactivated profile alike, so the sign-in
 * form cannot be used to discover which usernames exist.
 */
export async function authenticateManager(
  username: string,
  password: string
): Promise<ManagerProfile | null> {
  const supabase = await createServiceRoleClient()
  const { data, error } = await supabase
    .from('manager_profiles')
    .select('id, username, password_hash, upi_id, name, is_active, created_at, created_by')
    .ilike('username', username.trim())
    .maybeSingle()

  if (error || !data) return null

  const row = data as ManagerRow
  if (!row.is_active) return null
  if (!(await verifyPassword(password, row.password_hash))) return null

  return toProfile(row)
}
