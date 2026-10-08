import { NextResponse } from 'next/server'
import { requireAdmin } from '@/utils/auth/require-admin'
import { safeUploadFilename } from '@/utils/uploads'
import { createServerClient } from '@supabase/ssr'
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

    const buffer = await file.arrayBuffer()

    // In dummy/dev mode without Supabase storage, write to local public/uploads
    if (process.env.DUMMY_DB === 'True' || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads')
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
      fs.writeFileSync(path.join(uploadDir, safeName.filename), Buffer.from(buffer))
      return NextResponse.json({ url: `/uploads/${safeName.filename}` })
    }

    // Production: use Supabase Storage
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets()
    if (!buckets?.find((b: { name: string }) => b.name === 'uploads')) {
      await supabase.storage.createBucket('uploads', { public: true })
    }

    const { error } = await supabase
      .storage
      .from('uploads')
      .upload(safeName.filename, buffer, { 
        contentType: file.type, 
        upsert: true 
      })

    if (error) {
      console.error('Supabase upload error:', error)
      return NextResponse.json({ error: 'Failed to upload to storage' }, { status: 500 })
    }

    const { data: publicUrlData } = supabase.storage.from('uploads').getPublicUrl(safeName.filename)

    return NextResponse.json({ url: publicUrlData.publicUrl })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to upload' }, { status: 500 })
  }
}
