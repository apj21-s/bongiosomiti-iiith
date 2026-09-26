import { NextResponse } from 'next/server'
import { requireAdmin } from '@/utils/auth/require-admin'
import fs from 'fs'
import path from 'path'

export async function GET() {
  // This route had no authentication and deletes a directory before copying,
  // so it was a recursive delete any visitor could trigger.
  const guard = await requireAdmin(3)
  if (!guard.ok) return guard.response

  try {
    const src = path.join(process.cwd(), 'Mahalaya_Registration_Assets_CLEAN_FINAL (2)')
    const dest = path.join(process.cwd(), 'public', 'mahalaya_registration_assets')
    
    fs.rmSync(dest, { recursive: true, force: true })
    fs.cpSync(src, dest, { recursive: true })
    
    return NextResponse.json({ success: true, message: "Assets copied successfully!" })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message })
  }
}
