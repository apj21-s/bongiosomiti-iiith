import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/utils/auth/server'
import fs from 'fs'
import path from 'path'

export async function POST(request: Request) {
  const { data: authData } = await getCurrentUser()
  if (!authData?.user || authData.user.user_metadata?.tier < 2) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.]/g, '_')
    
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    
    const filePath = path.join(uploadDir, filename)
    fs.writeFileSync(filePath, buffer)

    return NextResponse.json({ url: `/uploads/${filename}` })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to upload' }, { status: 500 })
  }
}
