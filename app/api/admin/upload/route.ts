import { NextResponse } from 'next/server'
import { requireAdmin } from '@/utils/auth/require-admin'
import { safeUploadFilename } from '@/utils/uploads'
import fs from 'fs'
import path from 'path'

export async function POST(request: Request) {
  // Only the event editor uses this, and that page is super-admin only.
  const guard = await requireAdmin(3)
  if (!guard.ok) return guard.response

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const safeName = safeUploadFilename(file)
    if (!safeName.ok) {
      return NextResponse.json({ error: safeName.error }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    
    const filePath = path.join(uploadDir, safeName.filename)
    fs.writeFileSync(filePath, buffer)

    return NextResponse.json({ url: `/uploads/${safeName.filename}` })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to upload' }, { status: 500 })
  }
}
