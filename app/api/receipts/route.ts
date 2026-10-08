import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { safeUploadFilename, MAX_UPLOAD_BYTES } from '@/utils/uploads'
import { rateLimit, tooManyRequests } from '@/utils/rate-limit'

/**
 * Stores a payment receipt, so a verifier can look at the image beside the UTR
 * instead of taking the visitor's word for it.
 *
 * The bucket is private. Receipts are screenshots of somebody's banking app, so
 * nothing about them is public: they are written with the service-role client
 * and read back only through a signed URL issued to an admin.
 *
 * This is an unauthenticated write - it happens before the registration exists -
 * so it is deliberately narrow: rate limited, extension and size checked by the
 * same helper the admin uploader uses, and stored under a name this route
 * invents rather than one the client sent. The response is the storage path,
 * never a URL, and the register route re-checks its shape before filing it
 * against a ticket.
 */

const RECEIPT_LIMIT = 12
const RECEIPT_WINDOW_MS = 10 * 60 * 1000

export async function POST(request: Request) {
  // Keyed on the forwarded address. Campus traffic shares addresses, so the
  // allowance is per ten minutes rather than per minute.
  const who = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous'
  const limit = rateLimit(`receipt:${who}`, RECEIPT_LIMIT, RECEIPT_WINDOW_MS)
  if (!limit.allowed) {
    return tooManyRequests(limit.retryAfterSeconds, 'Too many receipt uploads. Please wait a few minutes.')
  }

  let file: File | null = null
  try {
    const form = await request.formData()
    const candidate = form.get('receipt')
    if (candidate instanceof File) file = candidate
  } catch {
    return NextResponse.json({ error: 'Could not read the upload.' }, { status: 400 })
  }

  if (!file) return NextResponse.json({ error: 'No receipt was attached.' }, { status: 400 })

  const checked = safeUploadFilename(file)
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 })

  const bytes = await file.arrayBuffer()
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'That receipt is larger than 5MB.' }, { status: 400 })
  }

  // The extension comes from the checked name; the rest of it is discarded,
  // because a filename chosen by whoever is uploading is not worth keeping.
  const extension = checked.filename.split('.').pop() || 'png'
  const path = `receipts/${randomUUID()}.${extension}`

  try {
    const supabase = await createServiceRoleClient()

    // DUMMY_DB swaps in a mock with no storage behind it. Nothing can be kept
    // in that mode, and a registration must not proceed as though it had been.
    if (!('storage' in supabase)) {
      return NextResponse.json(
        { error: 'Receipts cannot be stored while DUMMY_DB is on.' },
        { status: 503 }
      )
    }

    const { error } = await supabase.storage
      .from('receipts')
      .upload(path.replace(/^receipts\//, ''), bytes, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (error) {
      const missingBucket = /bucket/i.test(error.message) && /not found|does not exist/i.test(error.message)

      if (missingBucket) {
        // Bucket doesn't exist yet — create it as private and retry once.
        const { error: createError } = await supabase.storage.createBucket('receipts', {
          public: false,
          fileSizeLimit: MAX_UPLOAD_BYTES,
        })
        if (createError && !/already exists/i.test(createError.message)) {
          return NextResponse.json(
            { error: `Could not create the receipts bucket: ${createError.message}` },
            { status: 500 }
          )
        }

        // Retry the upload now that the bucket exists.
        const { error: retryError } = await supabase.storage
          .from('receipts')
          .upload(path.replace(/^receipts\//, ''), bytes, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
          })

        if (retryError) {
          return NextResponse.json({ error: 'Could not store the receipt.' }, { status: 500 })
        }
      } else {
        return NextResponse.json({ error: 'Could not store the receipt.' }, { status: 500 })
      }
    }
  } catch {
    return NextResponse.json({ error: 'Could not store the receipt.' }, { status: 500 })
  }

  return NextResponse.json({ path })
}
