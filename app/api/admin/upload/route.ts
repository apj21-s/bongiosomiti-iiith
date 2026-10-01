import { NextResponse } from 'next/server'
import { requireAdmin } from '@/utils/auth/require-admin'
import { safeUploadFilename } from '@/utils/uploads'
import { createServiceRoleClient } from '@/utils/supabase/server'

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
    const supabase = await createServiceRoleClient()
    
    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets()
    if (!buckets?.find(b => b.name === 'uploads')) {
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
