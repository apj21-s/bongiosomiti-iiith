import { NextResponse } from 'next/server'
import { getAdminTier } from '@/utils/auth/server'

export async function GET() {
  try {
    const tier = await getAdminTier()
    return NextResponse.json({ tier })
  } catch {
    // Fail closed: an error here must not read as "super admin".
    return NextResponse.json({ tier: 0 })
  }
}
