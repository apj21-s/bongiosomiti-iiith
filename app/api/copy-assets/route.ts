import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
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
